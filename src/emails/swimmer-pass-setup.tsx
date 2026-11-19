import * as React from "react";
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Row,
  Column,
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
  portalUrl = "https://swimtrack.example.com/portal",
  optOutUrl = "https://swimtrack.example.com/reminders/opt-out",
}: SwimmerPassSetupEmailProps) {
  const displayName = nickname ? `${swimmerName} ("${nickname}")` : swimmerName;

  return (
    <Html lang="en">
      <Head />
      <Preview>
        Important Update: How to use your 4-Digit PIN & Poolside GPS Check-In on SwimTrack 🏊
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
            <Section style={badgeWrapStyle}>
              <Text style={badgeStyle}>📍 NEW: ON-LOCATION GPS CHECK-IN &amp; 4-DIGIT PIN</Text>
            </Section>

            <Heading as="h1" style={headingStyle}>
              Your Swimmer Pass &amp; Poolside Check-In Guide 🏊
            </Heading>
            <Text style={greetingStyle}>Hey {displayName},</Text>
            <Text style={paragraphStyle}>
              We&apos;ve upgraded <strong>SwimTrack</strong> to keep squad attendance 100% fair and
              accurate. <strong>Attendance can only be marked on location at the swimming pool</strong>{" "}
              (or by the coach) — there is no check-in from home.
            </Text>

            {/* Quick 3-Step Setup Box (Table-based Row/Column for 100% Gmail/iOS/Android support) */}
            <Section style={guideBoxStyle}>
              <Text style={guideHeadingStyle}>⚡ How Your Swimmer Pass Works (3 Easy Steps)</Text>

              <Row style={stepRowStyle}>
                <Column style={stepNumberColStyle}>
                  <Text style={stepNumberStyle}>1</Text>
                </Column>
                <Column style={stepContentColStyle}>
                  <Text style={stepTitleStyle}>Sign In &amp; Set Your Private 4-Digit PIN</Text>
                  <Text style={stepDescStyle}>
                    Tap the button below, select <strong>{displayName}</strong> from the squad list,
                    and create your personal 4-digit security PIN. Your phone will remember your pass
                    automatically.
                  </Text>
                </Column>
              </Row>

              <Row style={stepRowStyle}>
                <Column style={stepNumberColStyle}>
                  <Text style={stepNumberStyle}>2</Text>
                </Column>
                <Column style={stepContentColStyle}>
                  <Text style={stepTitleStyle}>Check In Poolside with the GPS Radar</Text>
                  <Text style={stepDescStyle}>
                    When you arrive at the pool (within <strong>75m</strong>, from 30 mins before
                    start), tap <strong>Turn On Radar</strong> &rarr; tap{" "}
                    <strong>Mark Present</strong> &rarr; confirm your <strong>4-digit PIN</strong>.
                    Arrivals more than 10 minutes after start are recorded as <em>Late</em>.
                  </Text>
                </Column>
              </Row>

              <Row style={{ marginBottom: "0" }}>
                <Column style={stepNumberColStyle}>
                  <Text style={stepNumberStyle}>3</Text>
                </Column>
                <Column style={stepContentColStyle}>
                  <Text style={stepTitleStyle}>Can&apos;t Make It? Report an Excuse Early</Text>
                  <Text style={stepDescStyle}>
                    Sick or have an exam? Tap{" "}
                    <em>&ldquo;Can&apos;t make it? Report an excused absence&rdquo;</em> at least{" "}
                    <strong>60 minutes before practice starts</strong> so the coach is notified and
                    your streak stays protected.
                  </Text>
                </Column>
              </Row>
            </Section>

            {/* Action CTA Button */}
            <Section style={{ textAlign: "center", margin: "28px 0 22px 0" }}>
              <Link href={portalUrl} style={buttonStyle}>
                Open My Swimmer Pass &amp; Set 4-Digit PIN 🏊 &rarr;
              </Link>
              <Text style={tipTextStyle}>
                🔒 <strong>Anti-Buddy-Check-In Security:</strong> Each phone can only check in{" "}
                <strong>one swimmer per practice session</strong>, and every check-in requires your
                personal 4-digit PIN.
              </Text>
            </Section>

            {/* Rules Summary Card */}
            <Section style={featuresCardStyle}>
              <Text style={featuresTitleStyle}>Poolside Check-In Rules at a Glance:</Text>
              <Text style={featureItemStyle}>
                📍 <strong>Location Verified:</strong> Must be physically within <strong>75m</strong>{" "}
                of the pool complex with high-accuracy GPS enabled.
              </Text>
              <Text style={featureItemStyle}>
                ⏰ <strong>Check-In Window:</strong> Opens <strong>30 minutes before</strong>{" "}
                practice starts; check-ins more than <strong>10 minutes after start</strong> count as
                Late.
              </Text>
              <Text style={featureItemStyle}>
                🩹 <strong>Excused Absences:</strong> Self-reported excuses close{" "}
                <strong>60 minutes before</strong> session start. After that, message the coach
                directly.
              </Text>
              <Text style={featureItemStyle}>
                🔥 <strong>Streaks &amp; Squad Chalkboard:</strong> Track your attendance rate, active
                streak, and post banter on the live Squad Chalkboard.
              </Text>
            </Section>

            {/* Home Screen Tip */}
            <Section style={pwaTipBoxStyle}>
              <Text style={pwaTipTitleStyle}>📲 Add to Your Phone Home Screen (1-Tap App)</Text>
              <Text style={pwaTipTextStyle}>
                <strong>iPhone (Safari):</strong> Tap the <em>Share icon</em> (square with arrow)
                &rarr; tap <em>Add to Home Screen</em>.
                <br />
                <strong>Android (Chrome):</strong> Tap the <em>three dots menu</em> &rarr; tap{" "}
                <em>Install app</em> or <em>Add to Home Screen</em>.
              </Text>
            </Section>

            <Text style={closingStyle}>
              See you on the pool deck! Don&apos;t forget your goggles, cap, and water bottle. 🌊
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

// Styles (100% inline & table-compatible for mobile/desktop email clients)
const mainStyle: React.CSSProperties = {
  backgroundColor: "#f4f8fb",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  padding: "20px 8px",
  margin: 0,
};

const containerStyle: React.CSSProperties = {
  maxWidth: "600px",
  width: "100%",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  overflow: "hidden",
  boxShadow: "0 8px 30px rgba(0, 31, 63, 0.08)",
  border: "1px solid #dce8f0",
};

const headerStyle: React.CSSProperties = {
  backgroundColor: "#071B2B",
  padding: "26px 24px",
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
  fontSize: "11px",
  color: "#8AA3B8",
  letterSpacing: "1.2px",
  margin: "4px 0 0 0",
  textTransform: "uppercase",
};

const cardStyle: React.CSSProperties = {
  padding: "28px 24px 24px 24px",
};

const badgeWrapStyle: React.CSSProperties = {
  marginBottom: "12px",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#e0f2fe",
  color: "#0369a1",
  border: "1px solid #7dd3fc",
  borderRadius: "999px",
  padding: "4px 12px",
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.4px",
  margin: 0,
};

const headingStyle: React.CSSProperties = {
  fontSize: "22px",
  lineHeight: "28px",
  fontWeight: 800,
  color: "#071B2B",
  margin: "0 0 14px 0",
};

const greetingStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  color: "#173b54",
  margin: "0 0 10px 0",
};

const paragraphStyle: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#334155",
  margin: "0 0 20px 0",
};

const guideBoxStyle: React.CSSProperties = {
  backgroundColor: "#f0fdfa",
  border: "1px solid #99f6e4",
  borderRadius: "14px",
  padding: "18px 16px",
  marginBottom: "24px",
};

const guideHeadingStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 800,
  color: "#0f766e",
  margin: "0 0 14px 0",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const stepRowStyle: React.CSSProperties = {
  marginBottom: "14px",
};

const stepNumberColStyle: React.CSSProperties = {
  width: "38px",
  verticalAlign: "top",
  paddingRight: "10px",
};

const stepContentColStyle: React.CSSProperties = {
  verticalAlign: "top",
};

const stepNumberStyle: React.CSSProperties = {
  width: "28px",
  height: "28px",
  backgroundColor: "#0d9488",
  color: "#ffffff",
  borderRadius: "50%",
  fontWeight: 800,
  fontSize: "13px",
  lineHeight: "28px",
  textAlign: "center",
  margin: 0,
};

const stepTitleStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 700,
  color: "#134e4a",
  margin: "0 0 3px 0",
};

const stepDescStyle: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: "19px",
  color: "#334155",
  margin: 0,
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

const featuresCardStyle: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "16px 18px",
  marginBottom: "18px",
};

const featuresTitleStyle: React.CSSProperties = {
  fontSize: "12px",
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
  padding: "14px 16px",
  marginBottom: "18px",
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
  margin: "12px 0 0 0",
};

const footerStyle: React.CSSProperties = {
  backgroundColor: "#eef6fc",
  padding: "20px 24px",
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
  borderStyle: "solid",
  margin: "16px 0 12px 0",
};

const copyrightStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#7e9cb0",
  margin: 0,
};
