import { ContentPageView, contentPageMetadata } from "@/components/site/content-page-view";

export const generateMetadata = () => contentPageMetadata("kullanim-kosullari");

export default function Page() {
  return <ContentPageView slug="kullanim-kosullari" />;
}
