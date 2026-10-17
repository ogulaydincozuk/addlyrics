import { ContentPageView, contentPageMetadata } from "@/components/site/content-page-view";

export const generateMetadata = () => contentPageMetadata("ucretsiz-deneme-kosullari");

export default function Page() {
  return <ContentPageView slug="ucretsiz-deneme-kosullari" />;
}
