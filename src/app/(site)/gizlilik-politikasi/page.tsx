import { ContentPageView, contentPageMetadata } from "@/components/site/content-page-view";

export const generateMetadata = () => contentPageMetadata("gizlilik-politikasi");

export default function Page() {
  return <ContentPageView slug="gizlilik-politikasi" />;
}
