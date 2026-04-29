import { StatusCodes } from 'http-status-codes';

import { CategoryModel } from '@models/category.model';
import { ProductModel } from '@models/product.model';
import { ApiError } from '@utils/api-error';
import { toObjectId } from '@utils/object-id';
import { toPaginatedData } from '@utils/pagination';

interface CategoryPayload {
  name: string;
  description?: string;
  isActive?: boolean;
}

export const DEFAULT_CATEGORY_NAME = 'Không xác định';

export const listCategories = async (options: {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
}) => {
  const filters: Record<string, unknown> = {};

  const fallbackCategory = await CategoryModel.findOne({
    name: DEFAULT_CATEGORY_NAME
  });

  filters._id = { $ne: fallbackCategory?._id };
  if (typeof options.isActive === 'boolean') {
    filters.isActive = options.isActive;
  }

  if (options.search?.trim()) {
    const regex = new RegExp(options.search.trim(), 'i');
    filters.$or = [{ name: regex }];
  }

  const totalItems = await CategoryModel.countDocuments(filters);
  const items = await CategoryModel.find(filters)
    .sort({ createdAt: -1 })
    .skip((options.page - 1) * options.limit)
    .limit(options.limit)
    .lean();

  return toPaginatedData(items, totalItems, options.page, options.limit);
};

export const getCategoryById = async (categoryId: string) => {
  const category = await CategoryModel.findById(toObjectId(categoryId, 'categoryId')).lean();

  if (!category) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Category not found');
  }

  return category;
};

export const createCategory = async (payload: CategoryPayload) => {
  const created = await CategoryModel.create({
    name: payload.name,
    description: payload.description,
    isActive: payload.isActive ?? true
  });

  return created.toObject();
};

export const updateCategory = async (categoryId: string, payload: Partial<CategoryPayload>) => {
  const updateData: Record<string, unknown> = {
    ...payload
  };

  const updated = await CategoryModel.findByIdAndUpdate(
    toObjectId(categoryId, 'categoryId'),
    updateData,
    { returnDocument: 'after' }
  ).lean();

  if (!updated) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Category not found');
  }

  return updated;
};

const getOrCreateFallbackCategory = async () => {
  const fallbackCategory = await CategoryModel.findOne({
    name: DEFAULT_CATEGORY_NAME
  });

  if (fallbackCategory) {
    if (fallbackCategory.isActive === false) {
      fallbackCategory.isActive = true;
      await fallbackCategory.save();
    }

    return fallbackCategory;
  }

  return CategoryModel.create({
    name: DEFAULT_CATEGORY_NAME,
    description: 'Danh mục mặc định cho sản phẩm chưa xác định',
    isActive: true
  });
};

export const deleteCategory = async (categoryId: string) => {
  const targetId = toObjectId(categoryId, 'categoryId');
  const existingCategory = await CategoryModel.findById(targetId);

  if (!existingCategory) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Category not found');
  }

  if (existingCategory.name.trim().toLowerCase() === DEFAULT_CATEGORY_NAME.toLowerCase()) {
    throw new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Không thể xóa danh mục mặc định Không xác định'
    );
  }

  const fallbackCategory = await getOrCreateFallbackCategory();
  await ProductModel.updateMany(
    {
      categoryId: targetId
    },
    {
      $set: {
        categoryId: fallbackCategory._id
      }
    }
  );

  await ProductModel.updateMany(
    {
      categoryId: targetId
    },
    {
      $set: {
        isActive: false
      }
    }
  );

  await existingCategory.deleteOne();

  return {
    id: String(existingCategory._id)
  };
};
