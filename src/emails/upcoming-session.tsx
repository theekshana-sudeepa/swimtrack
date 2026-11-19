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

interface UpcomingSessionEmailProps {
  swimmerName?: string;
  sessionTitle?: string;
  dateStr?: string;
  timeStr?: string;
  location?: string;
  customMessage?: string;
  portalUrl?: string;
  optOutUrl?: string;
}

export default function UpcomingSessionEmail({
  swimmerName = "Swimmer",
  sessionTitle = "Saturday Morning Endurance Squad",
  dateStr = "Saturday, November 7, 2026",
  timeStr = "06:30 AM – 08:00 AM",
  location = "Royal College Aquatic Complex, Colombo",
  customMessage = "Friendly reminder for our upcoming swim session! Bring your goggles, cap, and hydration.",
  portalUrl = "https://swimtrack.example.com/portal#pool-radar",
  optOutUrl = "https://swimtrack.example.com/reminders/opt-out",
}: UpcomingSessionEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Upcoming Swim: {sessionTitle} on {dateStr}</Preview>
      <Body style={mainStyle}>
        <Container style={containerStyle}>
          {/* Header Brand */}
          <Section style={headerStyle}>
            <Text style={brandStyle}>SWIMTRACK</Text>
            <Text style={taglineStyle}>The Aquatic Control Room</Text>
          </Section>

          {/* Main Card */}
          <Section style={cardStyle}>
            <Heading style={headingStyle}>Upcoming Swimming Session</Heading>
            <Text style={greetingStyle}>Hi {swimmerName},</Text>
            <Text style={paragraphStyle}>
              {customMessage}
            </Text>

            {/* Session Info Box */}
            <Section style={infoBoxStyle}>
              <Text style={infoTitleStyle}>{sessionTitle}</Text>
              <Text style={infoRowStyle}>
                <strong>Date:</strong> {dateStr}
              </Text>
              <Text style={infoRowStyle}>
                <strong>Time:</strong> {timeStr}
              </Text>
              <Text style={infoRowStyle}>
                <strong>Location:</strong> {location}
              </Text>
            </Section>

            {/* Pool Radar Check-In CTA Button */}
            {portalUrl && (
              <Section style={{ textAlign: "center", margin: "24px 0 22px 0" }}>
                <Link href={portalUrl} style={buttonStyle}>
                  📍 Open Pool Radar &amp; Mark Attendance 🏊 &rarr;
                </Link>
                <Text style={tipTextStyle}>
                  🔒 <strong>On-Location GPS Only:</strong> Check-in unlocks poolside within{" "}
                  <strong>75m</strong> of the pool (starting 30 mins before practice) using your{" "}
                  <strong>4-digit PIN</strong>. Can&apos;t make it? Tap above at least{" "}
                  <strong>60 mins before start</strong> to report an excused absence.
                </Text>
              </Section>
            )}

            <Text style={paragraphStyle}>
              See you at the pool deck! Don&apos;t forget your goggles, cap, and water bottle.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              This is a personal swimming reminder sent via SwimTrack.
            </Text>
            <Text style={footerTextStyle}>
              To stop receiving these reminders,{" "}
              <Link href={optOutUrl} style={linkStyle}>
                manage your reminder preferences
              </Link>
              .
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const mainStyle: React.CSSProperties = {
  backgroundColor: "#F2FAFC",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  padding: "40px 10px",
  color: "#071B2B",
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

const infoBoxStyle: React.CSSProperties = {
  backgroundColor: "#F2FAFC",
  borderLeft: "4px solid #22C7D8",
  borderRadius: "8px",
  padding: "16px 20px",
  marginBottom: "24px",
};

const infoTitleStyle: React.CSSProperties = {
  fontSize: "17px",
  fontWeight: 700,
  color: "#071B2B",
  margin: "0 0 8px 0",
};

const infoRowStyle: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "#173b54",
  margin: "4px 0",
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: "#22C7D8",
  color: "#071B2B",
  padding: "14px 26px",
  borderRadius: "12px",
  fontWeight: 800,
  fontSize: "14px",
  textDecoration: "none",
  display: "inline-block",
  textAlign: "center",
  boxSizing: "border-box",
  boxShadow: "0 4px 14px rgba(34, 199, 216, 0.35)",
};

const tipTextStyle: React.CSSProperties = {
  fontSize: "12px",
  lineHeight: "17px",
  color: "#475569",
  marginTop: "12px",
  maxWidth: "480px",
  marginLeft: "auto",
  marginRight: "auto",
};

const footerStyle: React.CSSProperties = {
  backgroundColor: "#eef6fc",
  padding: "20px 32px",
  textAlign: "center",
  borderTop: "1px solid #D1EBF3",
};

const footerTextStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#4496cc",
  margin: "4px 0",
  lineHeight: "18px",
};

const linkStyle: React.CSSProperties = {
  color: "#22C7D8",
  textDecoration: "underline",
};

