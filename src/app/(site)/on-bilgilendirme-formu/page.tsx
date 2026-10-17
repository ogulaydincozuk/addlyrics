import { ContentPageView, contentPageMetadata } from "@/components/site/content-page-view";

export const generateMetadata = () => contentPageMetadata("on-bilgilendirme-formu");

export default function Page() {
  return <ContentPageView slug="on-bilgilendirme-formu" />;
}
