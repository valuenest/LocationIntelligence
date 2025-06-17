import { users, analysisRequests, usageLimits, type User, type InsertUser, type AnalysisRequest, type InsertAnalysisRequest, type UsageLimit, type InsertUsageLimit } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createAnalysisRequest(request: InsertAnalysisRequest): Promise<AnalysisRequest>;
  getAnalysisRequest(id: number): Promise<AnalysisRequest | undefined>;
  getAnalysisRequestByPaymentId(paymentId: string): Promise<AnalysisRequest | undefined>;
  updateAnalysisRequest(id: number, data: Partial<AnalysisRequest>): Promise<AnalysisRequest>;
  
  getUsageLimit(ipAddress: string): Promise<UsageLimit | undefined>;
  createUsageLimit(limit: InsertUsageLimit): Promise<UsageLimit>;
  updateUsageLimit(ipAddress: string, data: Partial<UsageLimit>): Promise<UsageLimit>;
  incrementFreeUsage(ipAddress: string): Promise<UsageLimit>;
  resetDailyUsage(ipAddress: string): Promise<UsageLimit>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private analysisRequests: Map<number, AnalysisRequest>;
  private usageLimits: Map<string, UsageLimit>;
  private currentUserId: number;
  private currentAnalysisId: number;

  constructor() {
    this.users = new Map();
    this.analysisRequests = new Map();
    this.usageLimits = new Map();
    this.currentUserId = 1;
    this.currentAnalysisId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createAnalysisRequest(request: InsertAnalysisRequest): Promise<AnalysisRequest> {
    const id = this.currentAnalysisId++;
    const analysisRequest: AnalysisRequest = {
      ...request,
      id,
      createdAt: new Date(),
    };
    this.analysisRequests.set(id, analysisRequest);
    return analysisRequest;
  }

  async getAnalysisRequest(id: number): Promise<AnalysisRequest | undefined> {
    return this.analysisRequests.get(id);
  }

  async getAnalysisRequestByPaymentId(paymentId: string): Promise<AnalysisRequest | undefined> {
    return Array.from(this.analysisRequests.values()).find(
      (request) => request.paymentId === paymentId
    );
  }

  async updateAnalysisRequest(id: number, data: Partial<AnalysisRequest>): Promise<AnalysisRequest> {
    const existing = this.analysisRequests.get(id);
    if (!existing) {
      throw new Error(`Analysis request with id ${id} not found`);
    }
    const updated = { ...existing, ...data };
    this.analysisRequests.set(id, updated);
    return updated;
  }

  async getUsageLimit(ipAddress: string): Promise<UsageLimit | undefined> {
    return this.usageLimits.get(ipAddress);
  }

  async createUsageLimit(limit: InsertUsageLimit): Promise<UsageLimit> {
    const usageLimit: UsageLimit = {
      ...limit,
      id: Date.now(), // Simple ID for in-memory storage
    };
    this.usageLimits.set(limit.ipAddress, usageLimit);
    return usageLimit;
  }

  async updateUsageLimit(ipAddress: string, data: Partial<UsageLimit>): Promise<UsageLimit> {
    const existing = this.usageLimits.get(ipAddress);
    if (!existing) {
      throw new Error(`Usage limit for IP ${ipAddress} not found`);
    }
    const updated = { ...existing, ...data };
    this.usageLimits.set(ipAddress, updated);
    return updated;
  }

  async incrementFreeUsage(ipAddress: string): Promise<UsageLimit> {
    let usageLimit = await this.getUsageLimit(ipAddress);
    
    if (!usageLimit) {
      usageLimit = await this.createUsageLimit({
        ipAddress,
        freeUsageCount: 1,
        lastResetDate: new Date(),
      });
    } else {
      // Check if we need to reset daily usage
      const now = new Date();
      const lastReset = new Date(usageLimit.lastResetDate);
      const daysSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceReset >= 1) {
        usageLimit = await this.resetDailyUsage(ipAddress);
      }
      
      usageLimit = await this.updateUsageLimit(ipAddress, {
        freeUsageCount: usageLimit.freeUsageCount + 1,
      });
    }
    
    return usageLimit;
  }

  async resetDailyUsage(ipAddress: string): Promise<UsageLimit> {
    const existing = this.usageLimits.get(ipAddress);
    if (!existing) {
      return await this.createUsageLimit({
        ipAddress,
        freeUsageCount: 0,
        lastResetDate: new Date(),
      });
    }
    
    return await this.updateUsageLimit(ipAddress, {
      freeUsageCount: 0,
      lastResetDate: new Date(),
    });
  }
}

export const storage = new MemStorage();
