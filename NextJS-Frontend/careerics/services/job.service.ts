import { fastapiApi } from "@/lib/api";
import type {
  APIJobApplication,
  APIJobInteraction,
  APIJobListResponse,
  APIJobPost,
  ApiResponse,
  JobApplicationStatus,
} from "@/types";

const DEFAULT_BROWSE_PAGE_SIZE = 20;
const JOB_PAGE_SIZE = 100;
const jobListCache = new Map<string, APIJobPost[]>();
const jobListPromiseCache = new Map<string, Promise<ApiResponse<APIJobPost[]>>>();

type JobBrowseParams = {
  skip?: number;
  limit?: number;
  userId?: string | null;
  query?: string;
  countries?: string[];
  cities?: string[];
  jobTypes?: string[];
  workTypes?: string[];
  careerLevels?: string[];
  sort?: "relevance" | "date" | "match";
  signal?: AbortSignal;
};

function getJobCacheKey(userId?: string | null): string {
  return userId ?? "guest";
}

function serializeMultiSelectParam(values?: string[]): string | undefined {
  if (!values?.length) {
    return undefined;
  }

  return values.join(",");
}

function buildJobBrowseQueryParams(params: JobBrowseParams = {}) {
  return {
    skip: params.skip ?? 0,
    limit: params.limit ?? DEFAULT_BROWSE_PAGE_SIZE,
    query: params.query?.trim() || undefined,
    countries: serializeMultiSelectParam(params.countries),
    cities: serializeMultiSelectParam(params.cities),
    job_types: serializeMultiSelectParam(params.jobTypes),
    work_types: serializeMultiSelectParam(params.workTypes),
    career_levels: serializeMultiSelectParam(params.careerLevels),
    sort: params.sort ?? "relevance",
    user_id: params.userId ?? undefined,
  };
}

function listJobsPage(
  params: JobBrowseParams = {},
): Promise<ApiResponse<APIJobListResponse>> {
  return fastapiApi.get<APIJobListResponse>("/jobs/", {
    params: buildJobBrowseQueryParams(params),
    signal: params.signal,
  });
}

function listSavedJobsPage(
  userId: string,
  skip: number,
  limit: number,
): Promise<ApiResponse<APIJobListResponse>> {
  return fastapiApi.get<APIJobListResponse>(`/jobs/user/${userId}/saved`, {
    params: {
      skip,
      limit,
    },
  });
}

function listUserApplicationsPage(
  userId: string,
  params: Omit<JobBrowseParams, "userId"> = {},
): Promise<ApiResponse<APIJobListResponse>> {
  return fastapiApi.get<APIJobListResponse>(`/jobs/user/${userId}/applications`, {
    params: buildJobBrowseQueryParams(params),
    signal: params.signal,
  });
}

async function collectAllJobs(
  loader: (skip: number, limit: number) => Promise<ApiResponse<APIJobListResponse>>,
): Promise<ApiResponse<APIJobPost[]>> {
  let skip = 0;
  const jobsById = new Map<string, APIJobPost>();
  let total = 0;

  while (true) {
    const response = await loader(skip, JOB_PAGE_SIZE);
    if (!response.success || !response.data) {
      return {
        data: [],
        success: false,
        message: response.message ?? "Failed to load jobs",
        errors: response.errors,
      };
    }

    const page = response.data;
    for (const job of page.jobs) {
      if (!jobsById.has(job.id)) {
        jobsById.set(job.id, job);
      }
    }
    total = page.total;
    skip += page.limit;

    if (jobsById.size >= total || page.jobs.length === 0) {
      break;
    }
  }

  return {
    data: Array.from(jobsById.values()),
    success: true,
  };
}

export const jobService = {
  listJobs(params: JobBrowseParams = {}): Promise<ApiResponse<APIJobListResponse>> {
    return listJobsPage(params);
  },

  searchJobs(params: {
    query: string;
    skip?: number;
    limit?: number;
    userId?: string | null;
    countries?: string[];
    cities?: string[];
    jobTypes?: string[];
    workTypes?: string[];
    careerLevels?: string[];
    sort?: "relevance" | "date" | "match";
    signal?: AbortSignal;
  }): Promise<ApiResponse<APIJobListResponse>> {
    const {
      query,
      skip = 0,
      limit = DEFAULT_BROWSE_PAGE_SIZE,
      userId,
      countries,
      cities,
      jobTypes,
      workTypes,
      careerLevels,
      sort = "relevance",
      signal,
    } = params;
    return fastapiApi.get<APIJobListResponse>("/jobs/search/query", {
      params: {
        query,
        skip,
        limit,
        countries: serializeMultiSelectParam(countries),
        cities: serializeMultiSelectParam(cities),
        job_types: serializeMultiSelectParam(jobTypes),
        work_types: serializeMultiSelectParam(workTypes),
        career_levels: serializeMultiSelectParam(careerLevels),
        sort,
        user_id: userId ?? undefined,
      },
      signal,
    });
  },

  getAllJobs(userId?: string | null, forceRefresh = false): Promise<ApiResponse<APIJobPost[]>> {
    const cacheKey = getJobCacheKey(userId);
    if (!forceRefresh && jobListCache.has(cacheKey)) {
      return Promise.resolve({
        data: jobListCache.get(cacheKey) ?? [],
        success: true,
      });
    }

    if (!forceRefresh && jobListPromiseCache.has(cacheKey)) {
      return jobListPromiseCache.get(cacheKey)!;
    }

    const pendingRequest = collectAllJobs((skip, limit) => listJobsPage({ skip, limit, userId })).then((response) => {
      if (response.success) {
        jobListCache.set(cacheKey, response.data);
      }
      return response;
    }).finally(() => {
      jobListPromiseCache.delete(cacheKey);
    });

    jobListPromiseCache.set(cacheKey, pendingRequest);
    return pendingRequest;
  },

  getJobDetails(jobId: string, userId?: string | null): Promise<ApiResponse<APIJobPost>> {
    return fastapiApi.get<APIJobPost>(`/jobs/${jobId}`, {
      params: {
        user_id: userId ?? undefined,
      },
    });
  },

  markJobViewed(jobId: string, userId: string): Promise<ApiResponse<APIJobInteraction>> {
    return fastapiApi.post<APIJobInteraction>(`/jobs/${jobId}/view`, undefined, {
      params: {
        user_id: userId,
      },
    });
  },

  saveJob(jobId: string, userId: string): Promise<ApiResponse<APIJobInteraction>> {
    return fastapiApi.post<APIJobInteraction>(`/jobs/${jobId}/save`, undefined, {
      params: {
        user_id: userId,
      },
    });
  },

  unsaveJob(jobId: string, userId: string): Promise<ApiResponse<APIJobInteraction>> {
    return fastapiApi.delete<APIJobInteraction>(`/jobs/${jobId}/save`, {
      params: {
        user_id: userId,
      },
    });
  },

  applyToJob(
    jobId: string,
    userId: string,
    status: JobApplicationStatus = "applied",
  ): Promise<ApiResponse<APIJobApplication>> {
    return fastapiApi.post<APIJobApplication>(`/jobs/${jobId}/apply`, { status }, {
      params: {
        user_id: userId,
      },
    });
  },

  getSavedJobs(
    userId: string,
    params: {
      skip?: number;
      limit?: number;
    } = {},
  ): Promise<ApiResponse<APIJobListResponse>> {
    const { skip = 0, limit = JOB_PAGE_SIZE } = params;
    return listSavedJobsPage(userId, skip, limit);
  },

  getAllSavedJobs(userId: string): Promise<ApiResponse<APIJobPost[]>> {
    return collectAllJobs((skip, limit) => listSavedJobsPage(userId, skip, limit));
  },

  getRecentlyViewedJobs(
    userId: string,
    params: {
      skip?: number;
      limit?: number;
    } = {},
  ): Promise<ApiResponse<APIJobListResponse>> {
    const { skip = 0, limit = JOB_PAGE_SIZE } = params;
    return fastapiApi.get<APIJobListResponse>(`/jobs/user/${userId}/recently-viewed`, {
      params: {
        skip,
        limit,
      },
    });
  },

  getUserApplications(
    userId: string,
    params: {
      skip?: number;
      limit?: number;
      query?: string;
      countries?: string[];
      cities?: string[];
      jobTypes?: string[];
      workTypes?: string[];
      careerLevels?: string[];
      sort?: "relevance" | "date" | "match";
      signal?: AbortSignal;
    } = {},
  ): Promise<ApiResponse<APIJobListResponse>> {
    const {
      skip = 0,
      limit = DEFAULT_BROWSE_PAGE_SIZE,
      query,
      countries,
      cities,
      jobTypes,
      workTypes,
      careerLevels,
      sort = "relevance",
      signal,
    } = params;
    return listUserApplicationsPage(userId, {
      skip,
      limit,
      query,
      countries,
      cities,
      jobTypes,
      workTypes,
      careerLevels,
      sort,
      signal,
    });
  },

  getAllUserApplications(userId: string): Promise<ApiResponse<APIJobPost[]>> {
    return collectAllJobs((skip, limit) => listUserApplicationsPage(userId, { skip, limit }));
  },

  invalidateJobList(userId?: string | null): void {
    const cacheKey = getJobCacheKey(userId);
    jobListCache.delete(cacheKey);
    jobListPromiseCache.delete(cacheKey);
  },
} as const;
