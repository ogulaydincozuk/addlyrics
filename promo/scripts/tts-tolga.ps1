# Windows'un Türkçe erkek sesi (Microsoft Tolga) ile WAV üretir.
# İş dosyası UTF-8 JSON dizisidir: [{ "text": "...", "out": "C:\\...\\a.wav", "rate": 1.05 }]
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tts-tolga.ps1 -Job job.json
param([Parameter(Mandatory = $true)][string]$Job)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  })[0]
function Await($op, [Type]$type) {
  $task = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  $task.Result
}

$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.DisplayName -like "*Tolga*" } | Select-Object -First 1
if (-not $voice) { throw "Microsoft Tolga sesi bulunamadı (Ayarlar > Saat ve dil > Konuşma)." }
$synth.Voice = $voice

$items = [IO.File]::ReadAllText($Job, [Text.Encoding]::UTF8) | ConvertFrom-Json
foreach ($item in $items) {
  $escaped = [System.Security.SecurityElement]::Escape($item.text)
  $rate = ([double]$item.rate).ToString([System.Globalization.CultureInfo]::InvariantCulture)
  $ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='tr-TR'><prosody rate='$rate'>$escaped</prosody></speak>"
  $stream = Await ($synth.SynthesizeSsmlToStreamAsync($ssml)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
  $reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
  $size = [uint32]$stream.Size
  Await ($reader.LoadAsync($size)) ([uint32]) | Out-Null
  $bytes = New-Object byte[] $size
  $reader.ReadBytes($bytes)
  [IO.File]::WriteAllBytes($item.out, $bytes)
}
