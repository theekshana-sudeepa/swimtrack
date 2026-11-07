import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#071B2B",
          borderRadius: "8px",
          border: "1px solid rgba(34, 199, 216, 0.4)",
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#22C7D8"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 12c3-2 6 2 9 0s6-2 9 0" />
          <path d="M2 17c3-2 6 2 9 0s6-2 9 0" />
          <circle cx="17" cy="6" r="2.5" fill="#FF907E" stroke="none" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}

