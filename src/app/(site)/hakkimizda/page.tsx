import { ContentPageView, contentPageMetadata } from "@/components/site/content-page-view";

export const generateMetadata = () => contentPageMetadata("hakkimizda");

export default function Page() {
  return <ContentPageView slug="hakkimizda" />;
}
