import { useEffect, useState } from "react";
import { Spin } from "antd";

export function PageFallback() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(t);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="flex items-center justify-center"
      style={{ minHeight: "40vh" }}
    >
      <Spin size="large" />
    </div>
  );
}
