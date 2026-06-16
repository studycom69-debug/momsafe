import { startOfWeek, endOfWeek, isWithinInterval, getDay } from "date-fns";

export interface FoodLog {
  created_at: string;
  calories: number;
  [key: string]: any;
}

/**
 * Calculates the precise start (Sun 00:00:00) and end (Sat 23:59:59.999) 
 * of the week for a given date using current date and day index.
 */
export function getWeekRange(now: Date = new Date()) {
  // 1. FIX WEEK RANGE
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay()); // Subtract current day index (getDay)
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // Add 6 days to startOfWeek
  end.setHours(23, 59, 59, 999); // Set hours to 23:59:59.999
  
  return {
    weekStart: start,
    weekEnd: end
  };
}

/**
 * Filters and groups calorie logs into seven day-level buckets for the current week.
 * Clamps the range to 'now' to avoid forward-dated logs.
 */
export function getWeeklyChartData(meals: FoodLog[], weekStart: Date, weekEnd: Date, now: Date = new Date()) {
  // 2. USE INDEX-BASED GROUPING
  const weekData = [0, 0, 0, 0, 0, 0, 0];
  const filteredLogs: FoodLog[] = [];

  // Loop logs
  meals.forEach((item) => {
    // 2. NORMALIZE LOG DATES
    const date = new Date(item.created_at);
    date.setHours(0, 0, 0, 0);
    
    // 3. FILTER CORRECTLY (Ensure date >= startOfWeek && date <= endOfWeek)
    if (date.getTime() >= weekStart.getTime() && date.getTime() <= weekEnd.getTime()) {
      // derive the day index (0=Sun ... 6=Sat)
      const dayIndex = new Date(item.created_at).getDay();
      // Accumulate calories
      weekData[dayIndex] += Math.floor(item.calories || 0);
      filteredLogs.push(item);
    }
  });

  // 4. DEBUG (TEMP)
  console.log("Weekly Calorie Intake - Debug:");
  console.log("- meals:", meals);
  console.log("- startOfWeek:", weekStart);
  console.log("- endOfWeek:", weekEnd);
  console.log("- filteredLogs:", filteredLogs);

  // 3. MAP TO CHART
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return days.map((day, index) => ({
    day,
    calories: weekData[index]
  }));
}
