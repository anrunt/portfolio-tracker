import { Suspense } from "react";

import ChatPopup from "./chat/chat-popup";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <ChatPopup />
      </Suspense>
    </>
  );
}
