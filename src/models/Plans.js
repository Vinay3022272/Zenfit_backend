import mongoose, { Schema } from "mongoose";

const PlanSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
    },
    image: {
      type: String,
      default: "",
    },
    workoutPlan: {
      schedule: [{ type: String, required: true }],
      exercises: [
        {
          day: { type: String, required: true },
          routines: [
            {
              name: { type: String, required: true },
              sets: { type: Number },
              reps: { type: Number },
              duration: { type: String },
              description: { type: String },
              exercises: [{ type: String }],
            },
          ],
        },
      ],
    },
    dietPlan: {
      dailyCalories: { type: Number, required: true },
      meals: [
        {
          name: { type: String, required: true },
          foods: [{ type: String, required: true }],
        },
      ],
    },
    isActive: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { timestamps: true }
);

PlanSchema.index({ userId: 1 });
PlanSchema.index({ isActive: 1 });

export const Plan = mongoose.models.Plan || mongoose.model("Plan", PlanSchema);