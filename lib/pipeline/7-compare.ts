import { z } from "zod";
import { logger } from "@/lib/clients/logger";
import { structuredCall } from "@/lib/clients/llm";
import { PipelineStageError, type CompanyProfile, type ComparisonResult } from "@/lib/types";

const STAGE = "Stage7-Compare";

const CompanyProfileSchema = z.object({
  name: z.string(),
  domain: z.string(),
  category: z.string(),
  offeringsSummary: z.string(),
  searchIntentPhrase: z.string().optional(),
  founders: z.array(z.string()).optional(),
  stats: z.object({
    fundingTotal: z.string().optional(),
    employeeCount: z.string().optional(),
    revenueEstimate: z.string().optional(),
    foundedYear: z.number().int().optional(),
    dataAvailability: z.object({
      funding: z.boolean(),
      revenue: z.boolean(),
      employeeCount: z.boolean()
    })
  })
});

const ComparisonResultSchema = z.object({
  userCompany: CompanyProfileSchema,
  competitors: z.array(CompanyProfileSchema),
  serviceOverlap: z.array(
    z.object({
      service: z.string(),
      companies: z.array(z.string())
    })
  ),
  gaps: z.array(
    z.object({
      company: z.string(),
      missingRelativeToUser: z.array(z.string())
    })
  )
});

export async function compareCompanies(
  userCompany: CompanyProfile,
  competitors: CompanyProfile[]
): Promise<ComparisonResult> {
  const start = Date.now();
  logger.stageStart(STAGE, "comparing companies", { competitors: competitors.length });

  try {
    const comparison = await structuredCall(
      STAGE,
      "You produce structured competitor comparison results from supplied company profiles. Use only supplied profile evidence; do not invent stats or unsupported product claims.",
      `Generate a ComparisonResult JSON object for this user company and competitors.

User company:
${JSON.stringify(userCompany, null, 2)}

Competitors:
${JSON.stringify(competitors, null, 2)}

Include serviceOverlap rows and feature gaps relative to the user company.`,
      ComparisonResultSchema
    );

    logger.stageComplete(STAGE, "companies compared", { durationMs: Date.now() - start });
    return comparison;
  } catch (error) {
    throw new PipelineStageError(STAGE, error instanceof Error ? error.message : String(error));
  }
}
