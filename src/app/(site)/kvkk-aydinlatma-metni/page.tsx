import { ContentPageView, contentPageMetadata } from "@/components/site/content-page-view";

export const generateMetadata = () => contentPageMetadata("kvkk-aydinlatma-metni");

export default function Page() {
  return <ContentPageView slug="kvkk-aydinlatma-metni" />;
}
