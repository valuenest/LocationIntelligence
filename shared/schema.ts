import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const analysisRequests = pgTable("analysis_requests", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  ipAddress: text("ip_address"),
  location: text("location").notNull(), // JSON string {lat, lng, address}
  amount: integer("amount").notNull(),
  propertyType: text("property_type").notNull(),
  planType: text("plan_type").notNull(), // 'free', 'basic', 'pro'
  propertyDetails: text("property_details"), // JSON string
  paymentId: text("payment_id"), // Razorpay payment ID
  paymentStatus: text("payment_status").default("pending").notNull(),
  status: text("status").default("pending").notNull(),
  results: text("results"), // JSON string of analysis results
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usageLimits = pgTable("usage_limits", {
  id: serial("id").primaryKey(),
  ipAddress: text("ip_address").notNull().unique(),
  freeUsageCount: integer("free_usage_count").default(0).notNull(),
  lastUsageDate: text("last_usage_date").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertAnalysisRequestSchema = createInsertSchema(analysisRequests).omit({
  id: true,
  createdAt: true,
});

export const insertUsageLimitSchema = createInsertSchema(usageLimits).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type AnalysisRequest = typeof analysisRequests.$inferSelect;
export type InsertAnalysisRequest = z.infer<typeof insertAnalysisRequestSchema>;
export type UsageLimit = typeof usageLimits.$inferSelect;
export type InsertUsageLimit = z.infer<typeof insertUsageLimitSchema>;
