import { z } from 'zod';

export const listCoursesSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional()
  })
});

export const courseIdParamSchema = z.object({
  params: z.object({
    courseId: z.string().min(1)
  })
});

export const moduleIdParamSchema = z.object({
  params: z.object({
    moduleId: z.string().min(1)
  })
});

export const lessonIdParamSchema = z.object({
  params: z.object({
    lessonId: z.string().min(1)
  })
});

export const createCourseSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    thumbnail: z.string().url().optional(),
    instructorId: z.string().min(1),
    isActive: z.boolean().optional()
  })
});

export const updateCourseSchema = z.object({
  params: z.object({
    courseId: z.string().min(1)
  }),
  body: z
    .object({
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      thumbnail: z.string().url().optional(),
      instructorId: z.string().min(1).optional(),
      isActive: z.boolean().optional()
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: 'At least one field is required'
    })
});

export const createModuleSchema = z.object({
  body: z.object({
    courseId: z.string().min(1),
    title: z.string().min(1),
    order: z.number().int().nonnegative().optional()
  })
});

export const updateModuleSchema = z.object({
  params: z.object({
    moduleId: z.string().min(1)
  }),
  body: z
    .object({
      title: z.string().min(1).optional(),
      order: z.number().int().nonnegative().optional()
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: 'At least one field is required'
    })
});

export const createLessonSchema = z.object({
  body: z.object({
    moduleId: z.string().min(1),
    title: z.string().min(1),
    content: z.string().optional(),
    duration: z.number().int().positive().optional(),
    isRequired: z.boolean().optional(),
    order: z.number().int().nonnegative().optional()
  })
});

export const updateLessonSchema = z.object({
  params: z.object({
    lessonId: z.string().min(1)
  }),
  body: z
    .object({
      title: z.string().min(1).optional(),
      content: z.string().optional(),
      duration: z.number().int().positive().optional(),
      isRequired: z.boolean().optional(),
      order: z.number().int().nonnegative().optional()
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: 'At least one field is required'
    })
});

export const enrollUserSchema = z.object({
  body: z.object({
    userId: z.string().min(1),
    courseId: z.string().min(1)
  })
});

export const listProgressSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional()
  })
});

export const completeLessonSchema = z.object({
  params: z.object({
    courseId: z.string().min(1),
    lessonId: z.string().min(1)
  })
});
