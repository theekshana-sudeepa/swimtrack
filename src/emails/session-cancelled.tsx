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
} from "@react-email/components";

interface SessionCancelledEmailProps {
  swimmerName?: string;
  sessionTitle?: string;
  dateStr?: string;
  cancelReason?: string;
}

export default function SessionCancelledEmail({
  swimmerName = "Swimmer",
  sessionTitle = "Wednesday Evening Technique Drills",
  dateStr = "Wednesday, November 4, 2026",
  cancelReason = "Adverse weather and thunderstorm warning in Colombo.",
}: SessionCancelledEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Cancelled: {sessionTitle} on {dateStr}</Preview>
      <Body style={mainStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={brandStyle}>SWIMTRACK</Text>
            <Text style={taglineStyle}>The Aquatic Control Room</Text>
          </Section>

          <Section style={cardStyle}>
            <Heading style={headingStyle}>Session Cancelled</Heading>
            <Text style={greetingStyle}>Hi {swimmerName},</Text>
            <Text style={paragraphStyle}>
              Please note that the following swimming session has been <strong>cancelled</strong>:
            </Text>

            <Section style={alertBoxStyle}>
              <Text style={alertTitleStyle}>{sessionTitle}</Text>
              <Text style={alertRowStyle}>
                <strong>Original Date:</strong> {dateStr}
              </Text>
              {cancelReason && (
                <Text style={alertRowStyle}>
                  <strong>Reason:</strong> {cancelReason}
                </Text>
              )}
            </Section>

            <Text style={paragraphStyle}>
              Do not travel to the pool facility. We will resume our regular schedule for the next session.
            </Text>
          </Section>

          <Section style={footerStyle}>
            <Text style={footerTextStyle}>SwimTrack Cancellation Notice</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const mainStyle: React.CSSProperties = {
  backgroundColor: "#F2FAFC",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
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
};

const headerStyle: React.CSSProperties = {
  backgroundColor: "#071B2B",
  padding: "24px 32px",
  textAlign: "center",
};

const brandStyle: React.CSSProperties = {
  color: "#FF907E",
  fontSize: "20px",
  fontWeight: 800,
  letterSpacing: "3px",
  margin: 0,
};

const taglineStyle: React.CSSProperties = {
  color: "#86c2e7",
  fontSize: "12px",
  margin: "4px 0 0 0",
};

const cardStyle: React.CSSProperties = {
  padding: "32px",
};

const headingStyle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  color: "#7F1D1D",
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

const alertBoxStyle: React.CSSProperties = {
  backgroundColor: "#FEF2F2",
  borderLeft: "4px solid #FF907E",
  borderRadius: "8px",
  padding: "16px 20px",
  marginBottom: "24px",
};

const alertTitleStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  color: "#7F1D1D",
  margin: "0 0 8px 0",
};

const alertRowStyle: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "#991B1B",
  margin: "4px 0",
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
  margin: 0,
};
