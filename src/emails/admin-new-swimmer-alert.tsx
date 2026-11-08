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

interface AdminNewSwimmerAlertEmailProps {
  swimmerName?: string;
  nickname?: string;
  email?: string;
  phone?: string;
  enrolledAt?: string;
  adminSwimmerUrl?: string;
  attendanceDeckUrl?: string;
}

export default function AdminNewSwimmerAlertEmail({
  swimmerName = "Laki Polla",
  nickname = "Polla King",
  email = "lakipolla@pollamail.com",
  phone = "+94 77 123 4567",
  enrolledAt = new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo" }),
  adminSwimmerUrl = "https://swimtrack.app/swimmers",
  attendanceDeckUrl = "https://swimtrack.app/attendance",
}: AdminNewSwimmerAlertEmailProps) {
  const displayName = nickname ? `${swimmerName} ("${nickname}")` : swimmerName;

  return (
    <Html lang="en">
      <Head />
      <Preview>🏊 New Swimmer Alert: {displayName} joined your squad!</Preview>
      <Body style={mainStyle}>
        <Container style={containerStyle}>
          {/* Header Brand */}
          <Section style={headerStyle}>
            <Text style={brandStyle}>SWIMTRACK</Text>
            <Text style={taglineStyle}>The Aquatic Control Room &bull; Admin Dispatch</Text>
          </Section>

          {/* Main Card */}
          <Section style={cardStyle}>
            <Heading style={headingStyle}>New Swimmer Enrolled! 🏊‍♂️</Heading>
            <Text style={paragraphStyle}>
              A new squad member has self-registered via your squad invite link and is now on your attendance register.
            </Text>

            {/* Swimmer Information Box */}
            <Section style={infoBoxStyle}>
              <Text style={infoTitleStyle}>📋 Member Credentials</Text>
              <Text style={infoRowStyle}>
                <strong>Full Name:</strong> {swimmerName}
              </Text>
              {nickname && (
                <Text style={infoRowStyle}>
                  <strong>Squad Nickname:</strong> {nickname}
                </Text>
              )}
              {email && (
                <Text style={infoRowStyle}>
                  <strong>Email:</strong> {email}
                </Text>
              )}
              {phone && (
                <Text style={infoRowStyle}>
                  <strong>WhatsApp / Phone:</strong> {phone}
                </Text>
              )}
              <Text style={infoRowStyle}>
                <strong>Assigned Persona:</strong> Eager Cadet 🏊 (Zero-Polla)
              </Text>
              <Text style={infoRowStyle}>
                <strong>Registered At:</strong> {enrolledAt} (Sri Lanka Time)
              </Text>
            </Section>

            {/* Quick Actions */}
            <Section style={{ textAlign: "center", margin: "24px 0" }}>
              <Link href={adminSwimmerUrl} style={buttonStyle}>
                View Swimmer in Control Room &rarr;
              </Link>
            </Section>

            <Section style={{ textAlign: "center" }}>
              <Link href={attendanceDeckUrl} style={secondaryLinkStyle}>
                Open Attendance Register Deck
              </Link>
            </Section>
          </Section>

          {/* Footer */}
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              This is an automated administrative notification sent by your SwimTrack instance.
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
  margin: "0 0 14px 0",
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
  marginBottom: "20px",
};

const infoTitleStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 700,
  color: "#071B2B",
  margin: "0 0 10px 0",
};

const infoRowStyle: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: "22px",
  color: "#173b54",
  margin: "4px 0",
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: "#22C7D8",
  color: "#071B2B",
  padding: "12px 24px",
  borderRadius: "10px",
  fontWeight: 700,
  fontSize: "13px",
  textDecoration: "none",
  display: "inline-block",
  textAlign: "center",
  boxShadow: "0 2px 8px rgba(34, 199, 216, 0.25)",
};

const secondaryLinkStyle: React.CSSProperties = {
  color: "#0284c7",
  fontSize: "12px",
  textDecoration: "underline",
  fontWeight: 600,
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

const hrStyle: React.CSSProperties = {
  borderColor: "#D1EBF3",
  margin: "16px 0 12px 0",
};

const copyrightStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#7e9cb0",
  margin: 0,
};

