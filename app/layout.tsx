import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "스킨픽 FINAL | 나에게 맞는 스킨케어 제품을 쉽게";
const description =
  "간단한 질문에 답하면 피부 타입, 피부 고민, 예산과 선호 사용감에 맞는 스킨케어 제품을 추천합니다.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = new URL(`${protocol}://${host}`);
  const socialImage = new URL("/og.png", origin).toString();

  return {
    metadataBase: origin,
    title,
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "ko_KR",
      images: [{ url: socialImage, width: 1200, height: 630, alt: "스킨픽 나에게 맞는 스킨케어 제품을 쉽게" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [socialImage] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
