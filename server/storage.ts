import { users, analysisRequests, usageLimits, type User, type InsertUser, type AnalysisRequest, type InsertAnalysisRequest, type UsageLimit, type InsertUsageLimit } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createAnalysisRequest(request: InsertAnalysisRequest): Promise<AnalysisRequest>;
  getAnalysisRequest(id: number): Promise<AnalysisRequest | undefined>;
  getAnalysisRequestByPaymentId(paymentId: string): Promise<AnalysisRequest | undefined>;
  getAnalysisRequestBySessionId(sessionId: string): Promise<AnalysisRequest | undefined>;
  updateAnalysisRequest(id: number, data: Partial<AnalysisRequest>): Promise<AnalysisRequest>;
  
  getUsageLimit(ipAddress: string): Promise<UsageLimit | undefined>;
  createUsageLimit(limit: InsertUsageLimit): Promise<UsageLimit>;
  updateUsageLimit(ipAddress: string, data: Partial<UsageLimit>): Promise<UsageLimit>;
  incrementFreeUsage(ipAddress: string): Promise<UsageLimit>;
  resetDailyUsage(ipAddress: string): Promise<UsageLimit>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createAnalysisRequest(request: InsertAnalysisRequest): Promise<AnalysisRequest> {
    const [analysisRequest] = await db
      .insert(analysisRequests)
      .values(request)
      .returning();
    return analysisRequest;
  }

  async getAnalysisRequest(id: number): Promise<AnalysisRequest | undefined> {
    const [request] = await db.select().from(analysisRequests).where(eq(analysisRequests.id, id));
    return request || undefined;
  }

  async getAnalysisRequestByPaymentId(paymentId: string): Promise<AnalysisRequest | undefined> {
    const [request] = await db.select().from(analysisRequests).where(eq(analysisRequests.paymentId, paymentId));
    return request || undefined;
  }

  async getAnalysisRequestBySessionId(sessionId: string): Promise<AnalysisRequest | undefined> {
    const [request] = await db.select().from(analysisRequests).where(eq(analysisRequests.sessionId, sessionId));
    return request || undefined;
  }

  async updateAnalysisRequest(id: number, data: Partial<AnalysisRequest>): Promise<AnalysisRequest> {
    const [updated] = await db
      .update(analysisRequests)
      .set(data)
      .where(eq(analysisRequests.id, id))
      .returning();
    
    if (!updated) {
      throw new Error(`Analysis request with id ${id} not found`);
    }
    
    return updated;
  }

  async getUsageLimit(ipAddress: string): Promise<UsageLimit | undefined> {
    const [limit] = await db.select().from(usageLimits).where(eq(usageLimits.ipAddress, ipAddress));
    return limit || undefined;
  }

  async createUsageLimit(limit: InsertUsageLimit): Promise<UsageLimit> {
    const [usageLimit] = await db
      .insert(usageLimits)
      .values(limit)
      .returning();
    return usageLimit;
  }

  async updateUsageLimit(ipAddress: string, data: Partial<UsageLimit>): Promise<UsageLimit> {
    const [updated] = await db
      .update(usageLimits)
      .set(data)
      .where(eq(usageLimits.ipAddress, ipAddress))
      .returning();
    
    if (!updated) {
      throw new Error(`Usage limit for IP ${ipAddress} not found`);
    }
    
    return updated;
  }

  async incrementFreeUsage(ipAddress: string): Promise<UsageLimit> {
    let usageLimit = await this.getUsageLimit(ipAddress);
    
    if (!usageLimit) {
      usageLimit = await this.createUsageLimit({
        ipAddress,
        freeUsageCount: 1,
        lastUsageDate: new Date().toISOString().split('T')[0],
      });
    } else {
      // Check if we need to reset daily usage
      const today = new Date().toISOString().split('T')[0];
      
      if (usageLimit.lastUsageDate !== today) {
        usageLimit = await this.resetDailyUsage(ipAddress);
      }
      
      usageLimit = await this.updateUsageLimit(ipAddress, {
        freeUsageCount: usageLimit.freeUsageCount + 1,
      });
    }
    
    return usageLimit;
  }

  async resetDailyUsage(ipAddress: string): Promise<UsageLimit> {
    const existing = await this.getUsageLimit(ipAddress);
    if (!existing) {
      return await this.createUsageLimit({
        ipAddress,
        freeUsageCount: 0,
        lastUsageDate: new Date().toISOString().split('T')[0],
      });
    }
    
    return await this.updateUsageLimit(ipAddress, {
      freeUsageCount: 0,
    });
  }
}

export const storage = new DatabaseStorage();
