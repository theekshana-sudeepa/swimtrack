import * as React from "react";
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Hr,
  Link,
} from "@react-email/components";

interface SwimmerPassSetupEmailProps {
  swimmerName?: string;
  nickname?: string;
  portalUrl?: string;
  optOutUrl?: string;
}

export default function SwimmerPassSetupEmail({
  swimmerName = "Swimmer",
  nickname,
  portalUrl = "https://swim-track-wine.vercel.app/portal",
  optOutUrl = "https://swim-track-wine.vercel.app/reminders/opt-out",
}: SwimmerPassSetupEmailProps) {
  const displayName = nickname ? `${swimmerName} ("${nickname}")` : swimmerName;

  return (
    <Html lang="en">
      <Head />
      <Preview>
        Quick Setup: How to access your personal SwimTrack Pass & 4-digit security PIN 🏊
      </Preview>
      <Body style={mainStyle}>
        <Container style={containerStyle}>
          {/* Header Brand */}
          <Section style={headerStyle}>
            <Text style={brandStyle}>SWIMTRACK</Text>
            <Text style={taglineStyle}>The Aquatic Control Room</Text>
          </Section>

          {/* Main Card */}
          <Section style={cardStyle}>
            <Heading style={headingStyle}>Your Swimmer Pass is Live! 🏊</Heading>
            <Text style={greetingStyle}>Hey {displayName},</Text>
            <Text style={paragraphStyle}>
              SwimTrack now features a direct <strong>Swimmer Pass</strong> portal. You can now check
              your attendance rate, active practice streaks, submit 1-tap RSVPs, and self-check in poolside!
            </Text>

            {/* Quick 3-Step Setup Box */}
            <Section style={guideBoxStyle}>
              <Text style={guideHeadingStyle}>⚡ Quick 3-Step Setup Guide</Text>

              <div style={stepRowStyle}>
                <Text style={stepNumberStyle}>1</Text>
                <div>
                  <Text style={stepTitleStyle}>Tap &ldquo;Swimmer Pass&rdquo;</Text>
                  <Text style={stepDescStyle}>
                    Click the button below or tap the <strong>🏊 Swimmer Pass</strong> button in the top header on the SwimTrack website.
                  </Text>
                </div>
              </div>

              <div style={stepRowStyle}>
                <Text style={stepNumberStyle}>2</Text>
                <div>
                  <Text style={stepTitleStyle}>Select Your Name</Text>
                  <Text style={stepDescStyle}>
                    Find your profile from the squad list (e.g. <em>{displayName}</em>).
                  </Text>
                </div>
              </div>

              <div style={stepRowStyle}>
                <Text style={stepNumberStyle}>3</Text>
                <div>
                  <Text style={stepTitleStyle}>Create Your Private 4-Digit PIN</Text>
                  <Text style={stepDescStyle}>
                    Pick a 4-digit security PIN (e.g. 1234). Only you know this PIN, so other squad friends cannot enter your profile!
                  </Text>
                </div>
              </div>
            </Section>

            {/* Action CTA Button */}
            <Section style={{ textAlign: "center", margin: "28px 0 20px 0" }}>
              <Link href={portalUrl} style={buttonStyle}>
                Open Swimmer Pass & Set PIN 🏊 &rarr;
              </Link>
              <Text style={tipTextStyle}>
                💡 <strong>Device Persistence:</strong> Once you enter your PIN, your phone browser will remember you automatically so you won&apos;t have to re-enter it on every visit.
              </Text>
            </Section>

            {/* Features Callout */}
            <Section style={featuresCardStyle}>
              <Text style={featuresTitleStyle}>What You Can Do Inside Your Pass:</Text>
              <Text style={featureItemStyle}>
                🔥 <strong>Attendance & Streak:</strong> See your personal attendance percentage, completed practices, and Polla risk meter.
              </Text>
              <Text style={featureItemStyle}>
                ✅ <strong>1-Tap RSVPs:</strong> Let the coach and friends know in advance if you&apos;re attending the next swimming practice.
              </Text>
              <Text style={featureItemStyle}>
                📍 <strong>Pool Radar Check-In:</strong> Autonomous GPS check-in when you arrive at the pool complex.
              </Text>
              <Text style={featureItemStyle}>
                💬 <strong>Squad Chalkboard:</strong> Post banter, motivation, and pool notes for the team.
              </Text>
            </Section>

            {/* Home Screen Tip */}
            <Section style={pwaTipBoxStyle}>
              <Text style={pwaTipTitleStyle}>📲 Add to Phone Home Screen (1-Tap App)</Text>
              <Text style={pwaTipTextStyle}>
                <strong>iPhone (Safari):</strong> Tap the <em>Share icon</em> (square with arrow) &rarr; tap <em>Add to Home Screen</em>.
                <br />
                <strong>Android (Chrome):</strong> Tap the <em>three dots menu</em> &rarr; tap <em>Install app</em> or <em>Add to Home Screen</em>.
              </Text>
            </Section>

            <Text style={closingStyle}>
              See you in lane 3! Don&apos;t forget your goggles, cap, and water bottle. 🌊
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              This email was dispatched by your SwimTrack Squad Administrator.
            </Text>
            <Text style={footerTextStyle}>
              If you ever wish to stop receiving reminders, you can{" "}
              <Link href={optOutUrl} style={linkStyle}>
                manage reminder preferences
              </Link>
              .
            </Text>
            <Hr style={hrStyle} />
            <Text style={copyrightStyle}>
              &copy; {new Date().getFullYear()} SwimTrack &bull; The Aquatic Control Room
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const mainStyle: React.CSSProperties = {
  backgroundColor: "#f4f8fb",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  padding: "24px 0",
};

const containerStyle: React.CSSProperties = {
  maxWidth: "600px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  overflow: "hidden",
  boxShadow: "0 8px 30px rgba(0, 31, 63, 0.08)",
  border: "1px solid #dce8f0",
};

const headerStyle: React.CSSProperties = {
  backgroundColor: "#071B2B",
  padding: "28px 32px",
  textAlign: "center",
};

const brandStyle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 900,
  letterSpacing: "4px",
  color: "#22C7D8",
  margin: 0,
};

const taglineStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#8AA3B8",
  letterSpacing: "1px",
  margin: "4px 0 0 0",
  textTransform: "uppercase",
};

const cardStyle: React.CSSProperties = {
  padding: "32px 32px 24px 32px",
};

const headingStyle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 800,
  color: "#071B2B",
  margin: "0 0 16px 0",
};

const greetingStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  color: "#173b54",
  margin: "0 0 12px 0",
};

const paragraphStyle: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#475569",
  margin: "0 0 20px 0",
};

const guideBoxStyle: React.CSSProperties = {
  backgroundColor: "#f0fdfa",
  border: "1px solid #99f6e4",
  borderRadius: "14px",
  padding: "20px 20px 16px 20px",
  marginBottom: "24px",
};

const guideHeadingStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 800,
  color: "#0f766e",
  margin: "0 0 16px 0",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const stepRowStyle: React.CSSProperties = {
  display: "flex",
  marginBottom: "14px",
  alignItems: "flex-start",
};

const stepNumberStyle: React.CSSProperties = {
  width: "28px",
  height: "28px",
  backgroundColor: "#14b8a6",
  color: "#ffffff",
  borderRadius: "50%",
  fontWeight: 800,
  fontSize: "14px",
  lineHeight: "28px",
  textAlign: "center",
  marginRight: "14px",
  flexShrink: 0,
};

const stepTitleStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 700,
  color: "#134e4a",
  margin: "0 0 2px 0",
};

const stepDescStyle: React.CSSProperties = {
  fontSize: "12px",
  lineHeight: "18px",
  color: "#334155",
  margin: 0,
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: "#22C7D8",
  color: "#071B2B",
  padding: "14px 32px",
  borderRadius: "12px",
  fontWeight: 800,
  fontSize: "15px",
  textDecoration: "none",
  display: "inline-block",
  textAlign: "center",
  boxShadow: "0 4px 14px rgba(34, 199, 216, 0.35)",
};

const tipTextStyle: React.CSSProperties = {
  fontSize: "11px",
  lineHeight: "16px",
  color: "#52758e",
  marginTop: "12px",
  maxWidth: "460px",
  marginLeft: "auto",
  marginRight: "auto",
};

const featuresCardStyle: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "18px 20px",
  marginBottom: "20px",
};

const featuresTitleStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 800,
  color: "#0f172a",
  margin: "0 0 10px 0",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const featureItemStyle: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#334155",
  margin: "6px 0",
};

const pwaTipBoxStyle: React.CSSProperties = {
  backgroundColor: "#f0f9ff",
  border: "1px solid #bae6fd",
  borderRadius: "12px",
  padding: "14px 18px",
  marginBottom: "20px",
};

const pwaTipTitleStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 700,
  color: "#0369a1",
  margin: "0 0 6px 0",
};

const pwaTipTextStyle: React.CSSProperties = {
  fontSize: "12px",
  lineHeight: "18px",
  color: "#334155",
  margin: 0,
};

const closingStyle: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "#475569",
  margin: "16px 0 0 0",
};

const footerStyle: React.CSSProperties = {
  backgroundColor: "#eef6fc",
  padding: "20px 32px",
  textAlign: "center",
};

const footerTextStyle: React.CSSProperties = {
  fontSize: "12px",
  lineHeight: "18px",
  color: "#52758e",
  margin: "4px 0",
};

const linkStyle: React.CSSProperties = {
  color: "#0284c7",
  textDecoration: "underline",
};

const hrStyle: React.CSSProperties = {
  borderColor: "#D1EBF3",
  margin: "16px 0 12px 0",
};

const copyrightStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#7e9cb0",
  margin: 0,
};
