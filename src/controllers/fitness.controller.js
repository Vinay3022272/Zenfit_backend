import { GoogleGenAI } from "@google/genai";
import User from "../models/User.js";
import { Plan } from "../models/Plans.js";

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Timeout configuration (45 seconds to stay under Vapi's 30s limit)
const TIMEOUT_MS = 45000;

// Validate and fix workout plan to ensure it has proper numeric types
function validateWorkoutPlan(plan) {
  const validatedPlan = {
    schedule: plan.schedule,
    exercises: plan.exercises.map((exercise) => ({
      day: exercise.day,
      routines: exercise.routines.map((routine) => ({
        name: routine.name,
        sets:
          typeof routine.sets === "number"
            ? routine.sets
            : parseInt(routine.sets) || 1,
        reps:
          typeof routine.reps === "number"
            ? routine.reps
            : parseInt(routine.reps) || 10,
      })),
    })),
  };
  return validatedPlan;
}

// Validate diet plan to ensure it strictly follows schema
function validateDietPlan(plan) {
  const validatedPlan = {
    dailyCalories:
      typeof plan.dailyCalories === "number"
        ? plan.dailyCalories
        : parseInt(plan.dailyCalories) || 2000,
    meals: plan.meals.map((meal) => ({
      name: meal.name,
      foods: meal.foods,
    })),
  };
  return validatedPlan;
}

// Helper function to create timeout promise
function createTimeout(ms) {
  return new Promise((_, reject) =>
    setTimeout(
      () =>
        reject(new Error("Request timeout - processing is taking too long")),
      ms
    )
  );
}

// Helper function to retry with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimit =
        error?.message?.includes("429") ||
        error?.message?.includes("quota") ||
        error?.message?.includes("Too Many Requests");

      // If it's the last retry or not a rate limit error, throw
      if (i === maxRetries - 1 || !isRateLimit) {
        throw error;
      }

      // Extract retry delay from error if available
      const retryMatch = error?.message?.match(/retry in (\d+(?:\.\d+)?)/);
      const suggestedDelay = retryMatch
        ? parseFloat(retryMatch[1]) * 1000
        : null;

      // Use suggested delay or exponential backoff
      const delay = suggestedDelay || baseDelay * Math.pow(2, i);

      console.log(
        `Rate limit hit, retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Max retries exceeded");
}

// Main logic for generating fitness plan
async function generateFitnessPlan(payload) {
  const {
    user_id,
    age,
    height,
    weight,
    injuries,
    workout_days,
    fitness_goal,
    fitness_level,
    dietary_restrictions,
  } = payload;

  console.log("Received payload:", payload);

  // Validate required fields
  if (!user_id) {
    throw new Error("user_id is required");
  }

  const workoutPrompt = `You are an experienced fitness coach creating a personalized workout plan based on:
  Age: ${age}
  Height: ${height}
  Weight: ${weight}
  Injuries or limitations: ${injuries || "None"}
  Available days for workout: ${workout_days}
  Fitness goal: ${fitness_goal}
  Fitness level: ${fitness_level}
  
  As a professional coach:
  - Consider muscle group splits to avoid overtraining the same muscles on consecutive days
  - Design exercises that match the fitness level and account for any injuries
  - Structure the workouts to specifically target the user's fitness goal
  
  CRITICAL SCHEMA INSTRUCTIONS:
  - Your output MUST contain ONLY the fields specified below, NO ADDITIONAL FIELDS
  - "sets" and "reps" MUST ALWAYS be NUMBERS, never strings
  - For example: "sets": 3, "reps": 10
  - Do NOT use text like "reps": "As many as possible" or "reps": "To failure"
  - Instead use specific numbers like "reps": 12 or "reps": 15
  - For cardio, use "sets": 1, "reps": 1 or another appropriate number
  - NEVER include strings for numerical fields
  - NEVER add extra fields not shown in the example below
  
  Return a JSON object with this EXACT structure:
  {
    "schedule": ["Monday", "Wednesday", "Friday"],
    "exercises": [
      {
        "day": "Monday",
        "routines": [
          {
            "name": "Exercise Name",
            "sets": 3,
            "reps": 10
          }
        ]
      }
    ]
  }
  
  DO NOT add any fields that are not in this example. Your response must be a valid JSON object with no additional text.`;

  const dietPrompt = `You are an experienced nutrition coach creating a personalized diet plan based on:
    Age: ${age}
    Height: ${height}
    Weight: ${weight}
    Fitness goal: ${fitness_goal}
    Dietary restrictions: ${dietary_restrictions || "None"}
    
    As a professional nutrition coach:
    - Calculate appropriate daily calorie intake based on the person's stats and goals
    - Create a balanced meal plan with proper macronutrient distribution
    - Include a variety of nutrient-dense foods while respecting dietary restrictions
    - Consider meal timing around workouts for optimal performance and recovery
    
    CRITICAL SCHEMA INSTRUCTIONS:
    - Your output MUST contain ONLY the fields specified below, NO ADDITIONAL FIELDS
    - "dailyCalories" MUST be a NUMBER, not a string
    - DO NOT add fields like "supplements", "macros", "notes", or ANYTHING else
    - ONLY include the EXACT fields shown in the example below
    - Each meal should include ONLY a "name" and "foods" array

    Return a JSON object with this EXACT structure and no other fields:
    {
      "dailyCalories": 2000,
      "meals": [
        {
          "name": "Breakfast",
          "foods": ["Oatmeal with berries", "Greek yogurt", "Black coffee"]
        },
        {
          "name": "Lunch",
          "foods": ["Grilled chicken salad", "Whole grain bread", "Water"]
        }
      ]
    }
    
    DO NOT add any fields that are not in this example. Your response must be a valid JSON object with no additional text.`;


 // Replace lines 168-181 with this:
console.log(`[${new Date().toISOString()}] Generating workout and diet plans in parallel...`);

const [workoutResult, dietResult] = await Promise.all([
  retryWithBackoff(() =>
    genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: workoutPrompt,
      config: {
        temperature: 0.4,
        topP: 0.9,
        responseMimeType: "application/json",
      },
    })
  ),
  retryWithBackoff(() =>
    genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: dietPrompt,
      config: {
        temperature: 0.4,
        topP: 0.9,
        responseMimeType: "application/json",
      },
    })
  ),
]);

console.log(`[${new Date().toISOString()}] Both plans generated successfully`);
console.log("Workout plan:", workoutResult.text);
console.log("Diet plan:", dietResult.text);

let workoutPlan = validateWorkoutPlan(JSON.parse(workoutResult.text));
let dietPlan = validateDietPlan(JSON.parse(dietResult.text));

  // Get user details for the plan
  const user = await User.findById(user_id);
  if (!user) {
    throw new Error("User not found");
  }

  // Save to MongoDB database using Mongoose
 console.log(`[${new Date().toISOString()}] Saving plan to database...`);
  const newPlan = await Plan.create({
    userId: user_id,
    name: `${fitness_goal} Plan - ${new Date().toLocaleDateString()}`,
    email: user.email,
    image: user.profilePic || "",
    workoutPlan,
    dietPlan,
    isActive: true,
  });

  const planId = newPlan._id.toString();
  console.log(`[${new Date().toISOString()}] Successfully created plan:`, planId);

  return {
    planId,
    workoutPlan,
    dietPlan,
  };
}

// Controller for generating fitness program
export const generateFitnessProgramController = async (req, res) => {
  try {
    const payload = req.body;

    // Race between the actual work and timeout
    const result = await Promise.race([
      generateFitnessPlan(payload),
      createTimeout(TIMEOUT_MS),
    ]);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error generating fitness plan:", error);

    // Determine error type for better response
    const isTimeout =
      error instanceof Error && error.message.includes("timeout");
    const isAPIDisabled =
      error instanceof Error && error.message.includes("SERVICE_DISABLED");
    const isRateLimit =
      error instanceof Error &&
      (error.message.includes("429") ||
        error.message.includes("quota") ||
        error.message.includes("Too Many Requests"));

    let errorMessage = error instanceof Error ? error.message : String(error);
    let statusCode = 500;

    if (isTimeout) {
      errorMessage =
        "Request timed out. The fitness plan generation is taking too long. Please try again.";
      statusCode = 504;
    } else if (isAPIDisabled) {
      errorMessage =
        "AI service is not properly configured. Please contact support.";
      statusCode = 503;
    } else if (isRateLimit) {
      errorMessage =
        "Service is temporarily busy. Please try again in a few moments.";
      statusCode = 429;
    }

    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
      errorType: isTimeout
        ? "timeout"
        : isAPIDisabled
          ? "service_disabled"
          : isRateLimit
            ? "rate_limit"
            : "unknown",
    });
  }
};