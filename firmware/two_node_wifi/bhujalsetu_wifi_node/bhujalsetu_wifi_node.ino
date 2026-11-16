/*
 * BhujalSetu two-node tabletop sender.
 * Upload this same sketch to each board, selecting NODE_ID below:
 *   Node 1 = recharge flow + HC-SR04 water level
 *   Node 2 = extraction flow only
 * Tabletop readings are never groundwater measurements.
 */
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include "secrets.h"

// Configure these values before uploading to each board.
#define NODE_ID "node-2"       // Change to "node-2" for the extraction ESP32.
#define DEVICE_ID "ESP32-NODE-2" // Use a distinct ID on Node 2, e.g. ESP32-NODE-2.
#define HAS_WATER_LEVEL 0      // Keep 1 for Node 1; change to 0 for Node 2.

static constexpr uint8_t FLOW_PIN = 27;
static constexpr uint8_t TRIG_PIN = 5;
static constexpr uint8_t ECHO_PIN = 34; // Input-only. Use a 5V-to-3.3V divider on HC-SR04 ECHO.
static constexpr float FLOW_PULSES_PER_LITER = 450.0f; // Calibrate with a measured volume.
static constexpr float TANK_USABLE_HEIGHT_CM = 30.0f; // Node 1 only: measure and set for your tank.
static constexpr uint32_t SEND_INTERVAL_MS = 10000;
static constexpr uint32_t FLOW_WINDOW_MS = 5000;

volatile uint32_t pendingPulses = 0;
uint64_t totalPulses = 0;
uint32_t lastWindowMs = 0;
uint32_t lastSendMs = 0;
uint32_t windowPulses = 0;
uint32_t windowElapsedMs = FLOW_WINDOW_MS;
float flowLpm = 0.0f;

void IRAM_ATTR onFlowPulse() { ++pendingPulses; }

bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  WiFi.mode(WIFI_STA);
  WiFi.begin(BHUJAL_WIFI_SSID, BHUJAL_WIFI_PASSWORD);
  Serial.print("[Wi-Fi] Connecting");
  for (uint8_t i = 0; i < 30 && WiFi.status() != WL_CONNECTED; ++i) {
    delay(500);
    Serial.print('.');
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(" failed; will retry.");
    return false;
  }
  Serial.printf("\n[Wi-Fi] Connected; address=%s\n", WiFi.localIP().toString().c_str());
  return true;
}

void updateFlow() {
  const uint32_t now = millis();
  const uint32_t elapsed = now - lastWindowMs;
  if (elapsed < FLOW_WINDOW_MS) return;
  noInterrupts();
  windowPulses = pendingPulses;
  pendingPulses = 0;
  interrupts();
  windowElapsedMs = elapsed;
  totalPulses += windowPulses;
  flowLpm = (windowPulses / FLOW_PULSES_PER_LITER) * (60000.0f / elapsed);
  lastWindowMs = now;
}

bool getCapturedAt(char* output, size_t outputSize) {
  const time_t now = time(nullptr);
  if (now < 1700000000) return false; // Wait until NTP has provided a real timestamp.
  struct tm utc;
  gmtime_r(&now, &utc);
  return strftime(output, outputSize, "%Y-%m-%dT%H:%M:%SZ", &utc) > 0;
}

bool readWaterLevel(float& distanceCm, float& levelCm) {
#if HAS_WATER_LEVEL
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(3);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  const uint32_t echoMicros = pulseIn(ECHO_PIN, HIGH, 30000UL);
  if (echoMicros == 0) return false;
  distanceCm = echoMicros * 0.0343f / 2.0f;
  if (distanceCm < 2.0f || distanceCm > 400.0f || distanceCm > TANK_USABLE_HEIGHT_CM + 20.0f) return false;
  levelCm = constrain(TANK_USABLE_HEIGHT_CM - distanceCm, 0.0f, TANK_USABLE_HEIGHT_CM);
  return true;
#else
  (void)distanceCm;
  (void)levelCm;
  return true;
#endif
}

void sendTelemetry() {
  if (!connectWiFi()) return;
  char capturedAt[25];
  if (!getCapturedAt(capturedAt, sizeof(capturedAt))) {
    Serial.println("[Time] Waiting for network time; sample not sent.");
    return;
  }

  float distanceCm = 0.0f;
  float levelCm = 0.0f;
  if (!readWaterLevel(distanceCm, levelCm)) {
    Serial.println("[Water level] No valid HC-SR04 echo; Node 1 packet skipped.");
    return;
  }

  JsonDocument packet;
  packet["schemaVersion"] = 1;
  packet["deviceId"] = DEVICE_ID;
  packet["nodeId"] = NODE_ID;
  packet["villageId"] = BHUJAL_VILLAGE_ID;
  packet["dataSource"] = "measured";
  packet["capturedAt"] = capturedAt;
  packet["flow"]["pulses"] = windowPulses;
  packet["flow"]["frequencyHz"] = windowPulses / (windowElapsedMs / 1000.0f);
  packet["flow"]["flowLpm"] = flowLpm;
  packet["flow"]["totalLiters"] = totalPulses / FLOW_PULSES_PER_LITER;
#if HAS_WATER_LEVEL
  packet["waterLevel"]["distanceCm"] = distanceCm;
  packet["waterLevel"]["levelCm"] = levelCm;
#endif

  String body;
  serializeJson(packet, body);
  HTTPClient http;
  http.begin(BHUJAL_API_URL);
  http.setTimeout(5000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + BHUJAL_DEVICE_API_KEY);
  const int status = http.POST(body);
  Serial.printf("[Telemetry] node=%s source=measured pulses=%lu flow=%.3f L/min", NODE_ID,
                static_cast<unsigned long>(windowPulses), flowLpm);
#if HAS_WATER_LEVEL
  Serial.printf(" water-level=%.1f cm", levelCm);
#endif
  Serial.printf(" HTTP=%d\n", status);
  if (status > 0) Serial.println(http.getString());
  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), onFlowPulse, FALLING);
#if HAS_WATER_LEVEL
  pinMode(TRIG_PIN, OUTPUT);
  digitalWrite(TRIG_PIN, LOW);
  pinMode(ECHO_PIN, INPUT);
#endif
  lastWindowMs = millis();
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  connectWiFi();
  Serial.printf("BhujalSetu %s ready; sensor readings will be sent as measured.\n", NODE_ID);
}

void loop() {
  updateFlow();
  if (millis() - lastSendMs >= SEND_INTERVAL_MS) {
    lastSendMs = millis();
    sendTelemetry();
  }
  delay(5);
}
