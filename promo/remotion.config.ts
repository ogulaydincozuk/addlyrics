import { Config } from "@remotion/cli/config";

// Düşük bellekli makinede tek sekmeyle render
Config.setConcurrency(1);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setCodec("h264");
Config.setCrf(18);
Config.setPixelFormat("yuv420p");
