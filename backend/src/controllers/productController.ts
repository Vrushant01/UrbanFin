import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Product, IProduct } from '../models/Product.js';
import { Category, ICategory } from '../models/Category.js';
import { ProductType } from '../types/index.js';
import { cache } from '../utils/cache.js';
import { processBase64ImageIfPresent } from './imageController.js';

const PRODUCT_CACHE_PREFIX = 'products:';
const CATEGORY_CACHE_PREFIX = 'categories:';
const CACHE_TTL = 30; // 30 seconds

// Category Endpoints
export const getCategories = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cacheKey = `${CATEGORY_CACHE_PREFIX}list`;
    const cached = cache.get<any[]>(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    const categories = await Category.find().sort({ name: 1 });
    const formatted = categories.map((c) => c.toJSON());

    cache.set(cacheKey, formatted, 60);
    res.status(200).json(formatted);
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ message: 'Category name is required' });
      return;
    }

    const trimmedName = name.trim();
    let category = await Category.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
    });

    if (!category) {
      category = await Category.create({ name: trimmedName });
    }

    cache.invalidate(CATEGORY_CACHE_PREFIX);

    // Also fetch updated list for convenience
    const allCategories = await Category.find().sort({ name: 1 });
    const formattedList = allCategories.map((c) => c.toJSON());

    const categoryJson = category.toJSON();

    res.status(201).json({
      ...categoryJson,
      categories: formattedList,
    });
  } catch (error) {
    next(error);
  }
};

// Product Endpoints
export const getProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, type, categoryId } = req.query;
    const hasSearch = !!(search && typeof search === 'string' && search.trim());
    const limit = hasSearch ? 500 : (Number(req.query.limit) || 120);
    const cacheKey = `${PRODUCT_CACHE_PREFIX}list:${search || ''}:${type || ''}:${categoryId || ''}:${limit}`;

    const cached = cache.get<any[]>(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    const filter: any = {};

    if (type && Object.values(ProductType).includes(type as ProductType)) {
      filter.type = type;
    }

    if (categoryId && typeof categoryId === 'string' && categoryId.trim()) {
      filter.categoryId = categoryId.trim();
    }

    if (hasSearch) {
      const term = (search as string).trim();
      // Search by name or category name
      const matchingCategories = await Category.find({
        name: { $regex: term, $options: 'i' },
      });
      const matchingCategoryIds = matchingCategories.map((c) => c._id.toString());

      filter.$or = [
        { name: { $regex: term, $options: 'i' } },
        { categoryId: { $in: matchingCategoryIds } },
      ];
    }

    const products = await Product.find(filter).sort({ createdAt: -1 }).limit(limit);
    const formatted = products.map((p) => p.toJSON());

    cache.set(cacheKey, formatted, CACHE_TTL);
    res.status(200).json(formatted);
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const product = mongoose.isValidObjectId(id)
      ? await Product.findById(id)
      : await Product.findOne({ _id: id });

    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    res.status(200).json(product.toJSON());
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, type, categoryId, salesPrice, cost, image } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ message: 'Product name is required' });
      return;
    }

    if (!categoryId || !categoryId.trim()) {
      res.status(400).json({ message: 'Category is required' });
      return;
    }

    const numSalesPrice = typeof salesPrice === 'number' ? salesPrice : parseFloat(salesPrice) || 0;
    const numCost = typeof cost === 'number' ? cost : parseFloat(cost) || 0;

    if (numSalesPrice < 0 || numCost < 0) {
      res.status(400).json({ message: 'Prices must be non-negative numbers' });
      return;
    }

    // Process image if base64
    const processedImage = await processBase64ImageIfPresent(image);

    const newProduct = await Product.create({
      name: name.trim(),
      type: type || ProductType.Goods,
      categoryId: categoryId.trim(),
      salesPrice: numSalesPrice,
      cost: numCost,
      image: processedImage,
    });

    cache.invalidate(PRODUCT_CACHE_PREFIX);

    res.status(201).json(newProduct.toJSON());
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, type, categoryId, salesPrice, cost, image } = req.body;

    const product = mongoose.isValidObjectId(id)
      ? await Product.findById(id)
      : await Product.findOne({ _id: id });

    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    if (name !== undefined) product.name = name.trim();
    if (type !== undefined) product.type = type;
    if (categoryId !== undefined) product.categoryId = categoryId.trim();

    if (salesPrice !== undefined) {
      const sp = typeof salesPrice === 'number' ? salesPrice : parseFloat(salesPrice) || 0;
      if (sp < 0) {
        res.status(400).json({ message: 'Sales price must be non-negative' });
        return;
      }
      product.salesPrice = sp;
    }

    if (cost !== undefined) {
      const cp = typeof cost === 'number' ? cost : parseFloat(cost) || 0;
      if (cp < 0) {
        res.status(400).json({ message: 'Cost must be non-negative' });
        return;
      }
      product.cost = cp;
    }

    if (image !== undefined) {
      product.image = await processBase64ImageIfPresent(image);
    }

    await product.save();
    cache.invalidate(PRODUCT_CACHE_PREFIX);

    res.status(200).json(product.toJSON());
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const result = mongoose.isValidObjectId(id)
      ? await Product.findByIdAndDelete(id)
      : await Product.findOneAndDelete({ _id: id });

    if (!result) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    cache.invalidate(PRODUCT_CACHE_PREFIX);

    res.status(200).json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};
