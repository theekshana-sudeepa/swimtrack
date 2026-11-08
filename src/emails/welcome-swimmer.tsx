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

interface WelcomeSwimmerEmailProps {
  swimmerName?: string;
  nickname?: string;
  optOutUrl?: string;
  portalUrl?: string;
}

export default function WelcomeSwimmerEmail({
  swimmerName = "Swimmer",
  nickname,
  optOutUrl = "https://swimtrack.app/reminders/opt-out",
  portalUrl = "https://swimtrack.app/portal",
}: WelcomeSwimmerEmailProps) {
  const displayName = nickname ? `${swimmerName} ("${nickname}")` : swimmerName;

  return (
    <Html lang="en">
      <Head />
      <Preview>Welcome to SwimTrack! You are officially on the squad roster 🏊</Preview>
      <Body style={mainStyle}>
        <Container style={containerStyle}>
          {/* Header Brand */}
          <Section style={headerStyle}>
            <Text style={brandStyle}>SWIMTRACK</Text>
            <Text style={taglineStyle}>The Aquatic Control Room</Text>
          </Section>

          {/* Main Card */}
          <Section style={cardStyle}>
            <Heading style={headingStyle}>Welcome to the Squad! 🌊</Heading>
            <Text style={greetingStyle}>Hey {displayName},</Text>
            <Text style={paragraphStyle}>
              You have been successfully added to our swimming attendance register. You are now part
              of the private squad roster.
            </Text>

            {/* Squad Persona Card */}
            <Section style={personaCardStyle}>
              <Text style={personaTitleStyle}>🎖️ YOUR SQUAD CREDENTIALS</Text>
              <Text style={personaRankStyle}>Eager Cadet 🏊</Text>
              <Text style={personaBadgeStyle}>Zero-Polla Status &bull; Clean Slate (100%)</Text>
              <Text style={personaDescStyle}>
                Your swimming journey begins here. Attend sessions, avoid the dreaded &quot;Polla Meter&quot;
                spike, and claim the coveted Zero-Polla Overlord crown.
              </Text>
            </Section>

            {/* Personal Swimmer Pass Button */}
            {portalUrl && (
              <Section style={{ textAlign: "center", margin: "28px 0" }}>
                <Link href={portalUrl} style={buttonStyle}>
                  Open My Swimmer Pass & RSVP 🏊
                </Link>
                <Text style={{ fontSize: "11px", color: "#52758e", marginTop: "10px", lineHeight: "16px" }}>
                  💡 <strong>Tip:</strong> Tap above and save it to your phone home screen! Check your attendance streak, upcoming practice times, and RSVP before sessions with 1 tap.
                </Text>
              </Section>
            )}

            {/* What to Expect Box */}
            <Section style={infoBoxStyle}>
              <Text style={infoTitleStyle}>What to Expect:</Text>
              <Text style={infoRowStyle}>
                &bull; <strong>Session Alerts:</strong> Friendly morning reminders at ~8:00 AM on scheduled swim days.
              </Text>
              <Text style={infoRowStyle}>
                &bull; <strong>Zero Passwords:</strong> You never need to remember a password or log in. Attendance is taken poolside by our administrator.
              </Text>
              <Text style={infoRowStyle}>
                &bull; <strong>Squad Recaps:</strong> Look out for our fun post-session stats and WhatsApp recaps.
              </Text>
            </Section>

            <Text style={paragraphStyle}>
              See you in the lanes! Don&apos;t forget your goggles, cap, and water bottle.
            </Text>
          </Section>

          {/* Footer & Opt-Out */}
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              This email was sent by your SwimTrack Squad Administrator.
            </Text>
            <Text style={footerTextStyle}>
              If you ever wish to stop receiving automated reminders, you can{" "}
              <Link href={optOutUrl} style={linkStyle}>
                opt out here with one click
              </Link>
              .
            </Text>
            <Hr style={hrStyle} />
            <Text style={copyrightStyle}>
              &copy; {new Date().getFullYear()} SwimTrack &bull; Non-commercial Open-Source Swimming Project
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// -----------------------------------------------------------------------------
// STYLES
// -----------------------------------------------------------------------------

const mainStyle: React.CSSProperties = {
  backgroundColor: "#F2FAFC",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  margin: "0",
  padding: "20px 0",
};

const containerStyle: React.CSSProperties = {
  maxWidth: "560px",
  margin: "0 auto",
  backgroundColor: "#FFFFFF",
  borderRadius: "16px",
  overflow: "hidden",
  border: "1px solid #D1EBF3",
  boxShadow: "0 4px 20px rgba(7, 27, 43, 0.05)",
};

const headerStyle: React.CSSProperties = {
  backgroundColor: "#071B2B",
  padding: "24px 32px",
  textAlign: "center",
};

const brandStyle: React.CSSProperties = {
  color: "#22C7D8",
  fontSize: "20px",
  fontWeight: 800,
  letterSpacing: "3px",
  margin: 0,
};

const taglineStyle: React.CSSProperties = {
  color: "#86c2e7",
  fontSize: "12px",
  margin: "4px 0 0 0",
  letterSpacing: "1px",
};

const cardStyle: React.CSSProperties = {
  padding: "32px",
};

const headingStyle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  color: "#071B2B",
  margin: "0 0 16px 0",
};

const greetingStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  color: "#102A3B",
  margin: "0 0 12px 0",
};

const paragraphStyle: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "24px",
  color: "#2b6f9d",
  margin: "0 0 20px 0",
};

const personaCardStyle: React.CSSProperties = {
  backgroundColor: "#071B2B",
  borderRadius: "12px",
  padding: "20px",
  marginBottom: "24px",
  border: "1px solid rgba(34, 199, 216, 0.3)",
  textAlign: "center",
};

const personaTitleStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "1.5px",
  color: "#86c2e7",
  margin: "0 0 8px 0",
};

const personaRankStyle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 800,
  color: "#22C7D8",
  margin: "0 0 4px 0",
};

const personaBadgeStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 700,
  color: "#5BE6CD",
  margin: "0 0 8px 0",
};

const personaDescStyle: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: "18px",
  color: "#D1EBF3",
  margin: 0,
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: "#22C7D8",
  color: "#071B2B",
  padding: "14px 28px",
  borderRadius: "12px",
  fontWeight: 800,
  fontSize: "14px",
  textDecoration: "none",
  display: "inline-block",
  textAlign: "center",
  boxShadow: "0 4px 14px rgba(34, 199, 216, 0.3)",
};

const infoBoxStyle: React.CSSProperties = {
  backgroundColor: "#F2FAFC",
  borderLeft: "4px solid #22C7D8",
  borderRadius: "8px",
  padding: "16px 20px",
  marginBottom: "24px",
};

const infoTitleStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  color: "#071B2B",
  margin: "0 0 8px 0",
};

const infoRowStyle: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#173b54",
  margin: "4px 0",
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

