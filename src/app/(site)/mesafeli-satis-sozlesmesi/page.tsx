import { ContentPageView, contentPageMetadata } from "@/components/site/content-page-view";

export const generateMetadata = () => contentPageMetadata("mesafeli-satis-sozlesmesi");

export default function Page() {
  return <ContentPageView slug="mesafeli-satis-sozlesmesi" />;
}
