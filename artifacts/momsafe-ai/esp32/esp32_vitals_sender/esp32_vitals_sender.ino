#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include "MAX30105.h"
#include "secrets.h"

const char* DEVICE_ID = "esp32-room-01";
const char* FIRMWARE_VERSION = "1.2.0";

// --- Hardware Setup ---
OneWire oneWire(4);
DallasTemperature sensors(&oneWire);
Adafruit_MPU6050 mpu;
MAX30105 heartSensor;

unsigned long sequenceId = 0;
unsigned long lastSendAt = 0;
unsigned long lastStepSampleAt = 0;

const unsigned long SEND_EVERY_MS = 30000;
const unsigned long STEP_SAMPLE_MS = 50;
const int PPG_SAMPLE_COUNT = 100;
const int PPG_SAMPLE_INTERVAL_MS = 25;

int stepCount = 0;
float lastTotalAccel = 0;
unsigned long lastStepAt = 0;

bool mpuReady = false;
bool max301Ready = false;

// ----------- PPG HELPERS -----------

int computeHeartRateBpm(long* irBuffer, int length, int sampleIntervalMs) {
  if (length < 10) return 0;

  long sum = 0;
  for (int i = 0; i < length; i++) sum += irBuffer[i];
  long avg = sum / length;
  long threshold = avg + (avg / 5);

  int beatIntervals[12];
  int intervalCount = 0;
  int lastPeakIndex = -1;

  for (int i = 2; i < length - 2; i++) {
    if (irBuffer[i] > threshold &&
        irBuffer[i] > irBuffer[i - 1] &&
        irBuffer[i] >= irBuffer[i + 1]) {
      if (lastPeakIndex >= 0) {
        int intervalMs = (i - lastPeakIndex) * sampleIntervalMs;
        if (intervalMs >= 300 && intervalMs <= 1500 && intervalCount < 12) {
          beatIntervals[intervalCount++] = intervalMs;
        }
      }
      lastPeakIndex = i;
    }
  }

  if (intervalCount == 0) return 0;

  long avgInterval = 0;
  for (int i = 0; i < intervalCount; i++) avgInterval += beatIntervals[i];
  avgInterval /= intervalCount;

  int bpm = (int)(60000L / avgInterval);
  if (bpm < 40 || bpm > 180) return 0;
  return bpm;
}

int computeSpO2Percent(long* redBuffer, long* irBuffer, int length) {
  if (length < 10) return 0;

  double dcRed = 0;
  double dcIr = 0;
  for (int i = 0; i < length; i++) {
    dcRed += redBuffer[i];
    dcIr += irBuffer[i];
  }
  dcRed /= length;
  dcIr /= length;

  if (dcRed <= 0 || dcIr <= 0) return 0;

  double acRed = 0;
  double acIr = 0;
  for (int i = 0; i < length; i++) {
    acRed += labs((long)(redBuffer[i] - dcRed));
    acIr += labs((long)(irBuffer[i] - dcIr));
  }
  acRed /= length;
  acIr /= length;

  if (acIr <= 0) return 0;

  double ratio = (acRed / dcRed) / (acIr / dcIr);
  int spo2 = (int)(104.0 - (17.0 * ratio));
  if (spo2 > 100) spo2 = 100;
  if (spo2 < 70) return 0;
  return spo2;
}

bool readHeartRateAndSpO2(int& heartRateBpm, int& spo2Percent) {
  if (!max301Ready) {
    heartRateBpm = 0;
    spo2Percent = 0;
    return false;
  }

  long irBuffer[PPG_SAMPLE_COUNT];
  long redBuffer[PPG_SAMPLE_COUNT];

  for (int i = 0; i < PPG_SAMPLE_COUNT; i++) {
    unsigned long sampleStart = millis();
    while (!heartSensor.available()) {
      heartSensor.check();
      if (millis() - sampleStart > 500) {
        heartRateBpm = 0;
        spo2Percent = 0;
        return false;
      }
      delay(1);
    }

    irBuffer[i] = heartSensor.getIR();
    redBuffer[i] = heartSensor.getRed();
    heartSensor.nextSample();
    delay(PPG_SAMPLE_INTERVAL_MS);
  }

  heartRateBpm = computeHeartRateBpm(irBuffer, PPG_SAMPLE_COUNT, PPG_SAMPLE_INTERVAL_MS);
  spo2Percent = computeSpO2Percent(redBuffer, irBuffer, PPG_SAMPLE_COUNT);
  return heartRateBpm > 0 || spo2Percent > 0;
}

// ----------- SENSOR FUNCTIONS -----------

bool readBodyTemperatureC(float& temperatureC) {
  sensors.requestTemperatures();
  float temp = sensors.getTempCByIndex(0);
  if (temp == DEVICE_DISCONNECTED_C || temp < 25.0f || temp > 45.0f) {
    return false;
  }
  temperatureC = temp;
  return true;
}

void updateActivitySteps() {
  if (!mpuReady) return;

  unsigned long now = millis();
  if (now - lastStepSampleAt < STEP_SAMPLE_MS) return;
  lastStepSampleAt = now;

  sensors_event_t accel, gyro, temp;
  if (!mpu.getEvent(&accel, &gyro, &temp)) return;

  float totalAccel = sqrt(
    sq(accel.acceleration.x) +
    sq(accel.acceleration.y) +
    sq(accel.acceleration.z)
  );

  const float stepThreshold = 11.5f;
  if (totalAccel > stepThreshold && lastTotalAccel <= stepThreshold) {
    if (now - lastStepAt > 350) {
      stepCount++;
      lastStepAt = now;
    }
  }

  lastTotalAccel = totalAccel;
}

bool readAccelerometer(float& motionX, float& motionY, float& motionZ) {
  if (!mpuReady) return false;

  sensors_event_t accel, gyro, temp;
  if (!mpu.getEvent(&accel, &gyro, &temp)) return false;

  motionX = accel.acceleration.x;
  motionY = accel.acceleration.y;
  motionZ = accel.acceleration.z;
  return true;
}

// ----------- API FUNCTION -----------

bool postVitals(
  float temperatureC,
  int steps,
  int heartRate,
  int spo2,
  float motionX,
  float motionY,
  float motionZ
) {
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  if (!http.begin(client, INGEST_URL)) {
    Serial.println("HTTP begin failed.");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + INGEST_TOKEN);

  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  doc["user_id"] = USER_ID;
  doc["body_temperature_c"] = temperatureC;
  doc["steps"] = steps;
  doc["heart_rate"] = heartRate;
  doc["spo2"] = spo2;
  doc["motion_x"] = motionX;
  doc["motion_y"] = motionY;
  doc["motion_z"] = motionZ;
  doc["sequence_id"] = sequenceId;
  doc["firmware_version"] = FIRMWARE_VERSION;

  String body;
  serializeJson(doc, body);

  int status = http.POST(body);
  String response = http.getString();
  http.end();

  if (status >= 200 && status < 300) {
    Serial.printf("Vitals sent. seq=%lu status=%d\n", sequenceId, status);
    return true;
  }

  Serial.printf("Send failed. status=%d body=%s\n", status, response.c_str());
  return false;
}

// ----------- WIFI -----------

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting WiFi");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConnected. IP=" + WiFi.localIP().toString());
  } else {
    Serial.println("\nWiFi connection failed.");
  }
}

// ----------- SETUP -----------

void setup() {
  Serial.begin(115200);
  delay(500);

  Wire.begin(21, 22);

  sensors.begin();
  sensors.setWaitForConversion(false);

  mpuReady = mpu.begin();
  if (!mpuReady) {
    Serial.println("MPU6050 failed!");
  } else {
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  }

  max301Ready = heartSensor.begin();
  if (!max301Ready) {
    Serial.println("MAX30102 failed!");
  } else {
    heartSensor.setup(
      60,
      4,
      2,
      100,
      411,
      4096
    );
    heartSensor.setPulseAmplitudeRed(0x1F);
    heartSensor.setPulseAmplitudeIR(0x1F);
    heartSensor.clearFIFO();
  }

  connectWifi();
}

// ----------- LOOP -----------

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWifi();

  updateActivitySteps();

  if (max301Ready) {
    heartSensor.check();
  }

  unsigned long now = millis();
  if (now - lastSendAt < SEND_EVERY_MS) return;
  lastSendAt = now;

  float temperatureC = 36.6f;
  if (!readBodyTemperatureC(temperatureC)) {
    Serial.println("Temperature sensor read failed.");
  }

  int heartRate = 0;
  int spo2 = 0;
  if (!readHeartRateAndSpO2(heartRate, spo2)) {
    Serial.println("PPG read failed. Keep finger still on MAX30102.");
  }

  float motionX = 0;
  float motionY = 0;
  float motionZ = 0;
  if (!readAccelerometer(motionX, motionY, motionZ)) {
    Serial.println("Accelerometer read failed.");
  }

  Serial.println("----- SENSOR DATA -----");
  Serial.printf("Temperature (C): %.2f\n", temperatureC);
  Serial.printf("Activity (steps): %d\n", stepCount);
  Serial.printf("Heart Rate (bpm): %d\n", heartRate);
  Serial.printf("SpO2 (%%): %d\n", spo2);
  Serial.printf("Accel X (m/s^2): %.2f\n", motionX);
  Serial.printf("Accel Y (m/s^2): %.2f\n", motionY);
  Serial.printf("Accel Z (m/s^2): %.2f\n", motionZ);
  Serial.println("-----------------------");

  if (!postVitals(temperatureC, stepCount, heartRate, spo2, motionX, motionY, motionZ)) {
    delay(1000);
    postVitals(temperatureC, stepCount, heartRate, spo2, motionX, motionY, motionZ);
  }

  sequenceId++;
}
