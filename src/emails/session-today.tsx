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
  Link,
} from "@react-email/components";

interface SessionTodayEmailProps {
  swimmerName?: string;
  sessionTitle?: string;
  timeStr?: string;
  location?: string;
  notes?: string;
}

export default function SessionTodayEmail({
  swimmerName = "Swimmer",
  sessionTitle = "Wednesday Evening Technique Drills",
  timeStr = "06:30 PM",
  location = "Royal College Aquatic Complex, Colombo",
  notes = "Remember to hydrate well beforehand and arrive 10 minutes early for dynamic stretching.",
}: SessionTodayEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Swim Today: {sessionTitle} at {timeStr}</Preview>
      <Body style={mainStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={brandStyle}>SWIMTRACK</Text>
            <Text style={taglineStyle}>The Aquatic Control Room</Text>
          </Section>

          <Section style={cardStyle}>
            <Heading style={headingStyle}>🏊 Swim Session Today!</Heading>
            <Text style={greetingStyle}>Hi {swimmerName},</Text>
            <Text style={paragraphStyle}>
              We have a swimming session scheduled for <strong>today</strong>.
            </Text>

            <Section style={infoBoxStyle}>
              <Text style={infoTitleStyle}>{sessionTitle}</Text>
              <Text style={infoRowStyle}>
                <strong>Starts:</strong> {timeStr}
              </Text>
              <Text style={infoRowStyle}>
                <strong>Location:</strong> {location}
              </Text>
              {notes && (
                <Text style={infoRowStyle}>
                  <strong>Focus:</strong> {notes}
                </Text>
              )}
            </Section>

            <Text style={paragraphStyle}>
              Pack your swimwear, goggles, and water bottle. See you on deck!
            </Text>
          </Section>

          <Section style={footerStyle}>
            <Text style={footerTextStyle}>SwimTrack Personal Sports Attendance</Text>
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
  borderLeft: "4px solid #5BE6CD",
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

