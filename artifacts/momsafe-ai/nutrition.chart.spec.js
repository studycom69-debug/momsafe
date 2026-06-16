import { assert } from "console";

/**
 * COPY OF LOGIC FROM src/lib/nutrition-chart-logic.ts
 * (Inlined for standalone execution in this environment)
 */
function getWeekRange(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return {
    weekStart: start,
    weekEnd: end
  };
}

function getWeeklyChartData(meals, weekStart, weekEnd, now = new Date()) {
  const weekData = [0, 0, 0, 0, 0, 0, 0];
  const filteredLogs = [];

  meals.forEach((item) => {
    const date = new Date(item.created_at);
    date.setHours(0, 0, 0, 0);
    
    if (date.getTime() >= weekStart.getTime() && date.getTime() <= weekEnd.getTime()) {
      const dayIndex = new Date(item.created_at).getDay();
      weekData[dayIndex] += Math.floor(item.calories || 0);
      filteredLogs.push(item);
    }
  });

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return days.map((day, index) => ({
    day,
    calories: weekData[index]
  }));
}

/**
 * 7. Testing & verification
 */
function runTests() {
  console.log("Starting Nutrition Chart Logic Tests...\n");

  // Test Case 1: Sunday 00:00
  {
    console.log("Test Case 1: Mock clock to Sunday 00:00:00");
    const mockNow = new Date("2026-04-12T00:00:00"); // A Sunday
    const { weekStart, weekEnd } = getWeekRange(mockNow);
    
    assert(weekStart.getDay() === 0, "weekStart should be Sunday");
    
    const meals = [
      { created_at: "2026-04-12T00:00:00", calories: 500 },
      { created_at: "2026-04-11T23:59:59", calories: 300 },
    ];
    
    const data = getWeeklyChartData(meals, weekStart, weekEnd, mockNow);
    assert(data[0].calories === 500, "Sunday should have 500 calories");
    assert(data[6].calories === 0, "Saturday should have 0 calories");
    console.log("✅ Passed Test Case 1");
  }

  // Test Case 2: Wednesday 12:00
  {
    console.log("\nTest Case 2: Mock clock to Wednesday 12:00:00");
    const mockNow = new Date("2026-04-15T12:00:00"); // A Wednesday
    const { weekStart, weekEnd } = getWeekRange(mockNow);
    
    const meals = [
      { created_at: "2026-04-12T08:00:00", calories: 200 }, // Sun
      { created_at: "2026-04-13T08:00:00", calories: 300 }, // Mon
      { created_at: "2026-04-14T08:00:00", calories: 400 }, // Tue
      { created_at: "2026-04-15T08:00:00", calories: 500 }, // Wed
      { created_at: "2026-04-15T13:00:00", calories: 600 }, // Wed (same day, should be included by normalization)
    ];
    
    const data = getWeeklyChartData(meals, weekStart, weekEnd, mockNow);
    assert(data[0].calories === 200, "Sun sum incorrect");
    assert(data[1].calories === 300, "Mon sum incorrect");
    assert(data[2].calories === 400, "Tue sum incorrect");
    assert(data[3].calories === 1100, "Wed sum incorrect (both logs on same day should be included)");
    assert(data[4].calories === 0, "Thu should be 0");
    console.log("✅ Passed Test Case 2");
  }

  // Test Case 3: Saturday 23:59
  {
    console.log("\nTest Case 3: Mock clock to Saturday 23:59:59");
    const mockNow = new Date("2026-04-18T23:59:59"); // A Saturday
    const { weekStart, weekEnd } = getWeekRange(mockNow);
    
    const meals = [
      { created_at: "2026-04-12T08:00:00", calories: 100 }, // Sun
      { created_at: "2026-04-18T23:00:00", calories: 900 }, // Sat
    ];
    
    const data = getWeeklyChartData(meals, weekStart, weekEnd, mockNow);
    assert(data[0].calories === 100, "Sun sum incorrect");
    assert(data[6].calories === 900, "Sat sum incorrect");
    console.log("✅ Passed Test Case 3");
  }

  // Test Case 4: Week Rollover
  {
    console.log("\nTest Case 4: Week Rollover Test");
    const satNow = new Date("2026-04-18T23:59:59");
    const sunNow = new Date("2026-04-19T00:00:01");
    
    const meals = [
      { created_at: "2026-04-18T23:00:00", calories: 1000 },
    ];
    
    const satRange = getWeekRange(satNow);
    const sunRange = getWeekRange(sunNow);
    
    const satData = getWeeklyChartData(meals, satRange.weekStart, satRange.weekEnd, satNow);
    const sunData = getWeeklyChartData(meals, sunRange.weekStart, sunRange.weekEnd, sunNow);
    
    assert(satData[6].calories === 1000, "Sat data should be present before rollover");
    assert(sunData[6].calories === 0, "Sat data from previous week should be gone after rollover");
    assert(sunData.every(d => d.calories === 0), "All bars should be zero for new week");
    console.log("✅ Passed Test Case 4");
  }

  console.log("\nAll tests passed successfully! 🚀");
}

runTests();
