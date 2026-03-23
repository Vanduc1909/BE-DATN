import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import type { Types } from 'mongoose';

import { logger } from '@/config/logger';
import { connectMongo, disconnectMongo } from '@/config/mongoose';
import { AddressModel } from '@/models/address.model';
import { CartModel } from '@/models/cart.model';
import { CategoryModel } from '@/models/category.model';
import { ColorModel } from '@/models/color.model';
import { InventoryLogModel } from '@/models/inventory-log.model';
import { OrderModel } from '@/models/order.model';
import { ProductVariantModel } from '@/models/product-variant.model';
import { ProductModel } from '@/models/product.model';
import { ReviewModel } from '@/models/review.model';
import { SizeModel } from '@/models/size.model';
import { UserModel } from '@/models/user.model';
import { VoucherModel } from '@/models/voucher.model';
import type {
  InventoryReason,
  MembershipTier,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Role,
  VoucherDiscountType
} from '@/types/domain';

interface SeedOptions {
  users: number;
  categories: number;
  products: number;
  variantsPerProduct: number;
  vouchers: number;
  carts: number;
  orders: number;
  reviews: number;
  clear: boolean;
  seed?: number;
}

const defaultOptions: SeedOptions = {
  users: 30,
  categories: 8,
  products: 40,
  variantsPerProduct: 4,
  vouchers: 10,
  carts: 20,
  orders: 25,
  reviews: 20,
  clear: false
};

const FIXED_SEED_USERS: Array<{
  email: string;
  fullName: string;
  role: Role;
  staffDepartment?: string;
}> = [
  {
    email: 'admin@gmail.com',
    fullName: 'Quản trị hệ thống',
    role: 'admin'
  },
  {
    email: 'buiduc1709@gmail.com',
    fullName: 'Bùi Đức',
    role: 'admin'
  },
  {
    email: 'nhanvien@gmail.com',
    fullName: 'Nhân viên cửa hàng',
    role: 'staff',
    staffDepartment: 'Sales'
  },
  {
    email: 'nguyenvanducanh04@gmail.com',
    fullName: 'Nguyễn Văn Đức Anh',
    role: 'customer'
  },
  {
    email: 'tutaph41643@fpt.edu.vn',
    fullName: 'Trần Tú',
    role: 'customer'
  },
  {
    email: 'huynqph46255@fpt.edu.vn',
    fullName: 'Quốc Huy',
    role: 'customer'
  },
  {
    email: 'dungpdph50412@gmail.com',
    fullName: 'Phạm Dũng',
    role: 'customer'
  }
];
const colorPalette = [
  { name: 'Black', hex: '#111111' },
  { name: 'White', hex: '#F5F5F5' },
  { name: 'Red', hex: '#E53935' },
  { name: 'Blue', hex: '#1E88E5' },
  { name: 'Green', hex: '#43A047' },
  { name: 'Yellow', hex: '#FDD835' },
  { name: 'Gray', hex: '#757575' },
  { name: 'Pink', hex: '#D81B60' },
  { name: 'Brown', hex: '#6D4C41' },
  { name: 'Purple', hex: '#8E24AA' }
] as const;

const toInteger = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
};

const toBoolean = (value: string | undefined, fallback: boolean) => {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const map = new Map<string, string>();

  for (const arg of args) {
    if (!arg.startsWith('--')) {
      continue;
    }

    const withoutPrefix = arg.slice(2);

    if (withoutPrefix.includes('=')) {
      const [key, value] = withoutPrefix.split('=');
      map.set(key, value);
      continue;
    }

    map.set(withoutPrefix, 'true');
  }

  return map;
};

const parseOptions = (): SeedOptions => {
  const args = parseArgs();

  const get = (key: string, envKey: string) => {
    return args.get(key) ?? process.env[envKey];
  };

  return {
    users: toInteger(get('users', 'SEED_USERS'), defaultOptions.users),
    categories: toInteger(get('categories', 'SEED_CATEGORIES'), defaultOptions.categories),
    products: toInteger(get('products', 'SEED_PRODUCTS'), defaultOptions.products),
    variantsPerProduct: toInteger(
      get('variantsPerProduct', 'SEED_VARIANTS_PER_PRODUCT'),
      defaultOptions.variantsPerProduct
    ),
    vouchers: toInteger(get('vouchers', 'SEED_VOUCHERS'), defaultOptions.vouchers),
    carts: toInteger(get('carts', 'SEED_CARTS'), defaultOptions.carts),
    orders: toInteger(get('orders', 'SEED_ORDERS'), defaultOptions.orders),
    reviews: toInteger(get('reviews', 'SEED_REVIEWS'), defaultOptions.reviews),
    clear: toBoolean(get('clear', 'SEED_CLEAR'), defaultOptions.clear),
    seed: (() => {
      const parsed = toInteger(get('seed', 'SEED_RANDOM_SEED'), -1);
      return parsed >= 0 ? parsed : undefined;
    })()
  };
};

const uniqueSuffix = () => `${Date.now()}-${faker.string.alphanumeric(6).toLowerCase()}`;

const randomImage = (seed: string) => `https://picsum.photos/seed/${seed}/1000/1000`;

const clearCollections = async () => {
  try {
    await ProductVariantModel.collection.drop();
  } catch (error) {
    const code = (error as { code?: number })?.code;

    if (code !== 26) {
      throw error;
    }
  }

  await Promise.all([
    ReviewModel.deleteMany({}),
    OrderModel.deleteMany({}),
    CartModel.deleteMany({}),
    InventoryLogModel.deleteMany({}),
    ProductModel.deleteMany({}),
    VoucherModel.deleteMany({}),
    AddressModel.deleteMany({}),
    CategoryModel.deleteMany({}),
    UserModel.deleteMany({}),
    ColorModel.deleteMany({}),
    SizeModel.deleteMany({})
  ]);
};

const seedUsers = async (count: number) => {
  if (count === 0) {
    return [];
  }

  const defaultPasswordHash = await bcrypt.hash('12345678', 10);
  const targetCount = Math.max(count, FIXED_SEED_USERS.length);
  const roleCycle: Role[] = ['customer', 'staff', 'customer'];
  const tierPool: MembershipTier[] = ['bronze', 'silver', 'gold', 'platinum'];

  const fixedUserPayloads = FIXED_SEED_USERS.map((account, index) => ({
    email: account.email,
    passwordHash: defaultPasswordHash,
    fullName: account.fullName,
    phone: faker.phone.number({ style: 'international' }),
    role: account.role,
    avatarUrl: randomImage(`fixed-user-${index + 1}`),
    loyaltyPoints: faker.number.int({ min: 0, max: 10000 }),
    membershipTier: faker.helpers.arrayElement(tierPool),
    staffDepartment:
      account.role !== 'customer'
        ? (account.staffDepartment ?? faker.commerce.department())
        : undefined,
    staffStartDate: account.role !== 'customer' ? faker.date.past() : undefined
  }));

  const randomUserPayloads = Array.from(
    { length: targetCount - fixedUserPayloads.length },
    (_, index) => {
      const idPart = `${index + 1}-${uniqueSuffix()}`;
      const role = roleCycle[index % roleCycle.length];

      return {
        email: `user_${idPart}@example.com`,
        passwordHash: defaultPasswordHash,
        fullName: faker.person.fullName(),
        phone: faker.phone.number({ style: 'international' }),
        role,
        avatarUrl: randomImage(`user-${idPart}`),
        loyaltyPoints: faker.number.int({ min: 0, max: 10000 }),
        membershipTier: faker.helpers.arrayElement(tierPool),
        staffDepartment: role !== 'customer' ? faker.commerce.department() : undefined,
        staffStartDate: role !== 'customer' ? faker.date.past() : undefined
      };
    }
  );

  return UserModel.insertMany([...fixedUserPayloads, ...randomUserPayloads]);
};

const seedAddresses = async (userIds: Types.ObjectId[]) => {
  if (userIds.length === 0) {
    return [];
  }

  const payloads = userIds.map((userId) => ({
    userId,
    label: faker.helpers.arrayElement(['Home', 'Office']),
    recipientName: faker.person.fullName(),
    phone: faker.phone.number({ style: 'international' }),
    street: faker.location.streetAddress(),
    city: faker.location.city(),
    district: faker.location.county(),
    ward: faker.location.state(),
    isDefault: true
  }));

  return AddressModel.insertMany(payloads);
};

const seedCategories = async (count: number) => {
  if (count === 0) {
    return [];
  }

  const categories: Array<{ _id: Types.ObjectId }> = [];

  for (let index = 0; index < count; index += 1) {
    const name = `${faker.commerce.department()} ${index + 1}`;
    const slug = `${buildSlug(name)}-${uniqueSuffix()}`;
    const parentCandidate = index > 0 && faker.datatype.boolean() ? categories[0]?._id : undefined;

    const created = await CategoryModel.create({
      name,
      slug,
      description: faker.lorem.sentence(),
      parentId: parentCandidate,
      image: randomImage(`category-${slug}`),
      isActive: true
    });

    categories.push({ _id: created._id as Types.ObjectId });
  }

  return categories;
};

const seedProducts = async (count: number, categoryIds: Types.ObjectId[]) => {
  if (count === 0 || categoryIds.length === 0) {
    return [];
  }

  const payloads = Array.from({ length: count }, (_, index) => {
    const name = faker.commerce.productName();
    const idPart = `${index + 1}-${uniqueSuffix()}`;

    return {
      name,
      categoryId: faker.helpers.arrayElement(categoryIds),
      description: faker.commerce.productDescription(),
      attributes: {
        brand: faker.company.name(),
        material: faker.commerce.productMaterial()
      },
      images: [randomImage(`product-${idPart}-1`), randomImage(`product-${idPart}-2`)],
      isAvailable: true,
      metaTitle: `${name} | ${faker.company.name()}`,
      metaDescription: faker.lorem.sentence(),
      averageRating: 0,
      reviewCount: 0,
      soldCount: 0
    };
  });

  return ProductModel.insertMany(payloads);
};

const seedColors = async () => {
  const payloads = colorPalette.map((color) => ({
    name: color.name,
    slug: buildSlug(color.name),
    hexCode: color.hex,
    isActive: true
  }));
  return ColorModel.insertMany(payloads);
};

const seedSizes = async () => {
  const sizes = ['S', 'M', 'L', 'XL', 'XXL', 'Standard'];
  const payloads = sizes.map((size) => ({
    name: size,
    slug: buildSlug(size),
    isActive: true
  }));
  return SizeModel.insertMany(payloads);
};

const seedVariants = async (
  productIds: Types.ObjectId[],
  variantsPerProduct: number,
  colors: Array<{ _id: Types.ObjectId; name: string; hexCode?: string }>,
  sizes: Array<{ _id: Types.ObjectId; name: string }>
) => {
  if (productIds.length === 0 || variantsPerProduct === 0 || colors.length === 0) {
    return [];
  }

  const countPerProduct = Math.min(variantsPerProduct, colors.length);
  const payloads: Array<Record<string, unknown>> = [];
  const standardSize = sizes.find((s) => s.name === 'Standard') || sizes[0];

  productIds.forEach((productId, productIndex) => {
    const shuffledColors = faker.helpers.shuffle([...colors]);

    for (let variantIndex = 0; variantIndex < countPerProduct; variantIndex += 1) {
      const color = shuffledColors[variantIndex];
      const basePrice = faker.number.int({ min: 80000, max: 3000000 });
      const stockQuantity = faker.number.int({ min: 0, max: 120 });

      payloads.push({
        productId,
        sku: `SKU-${productIndex + 1}-${variantIndex + 1}-${faker.string.alphanumeric(6).toUpperCase()}`,
        colorId: color._id,
        sizeId: standardSize?._id,
        size: standardSize?.name || 'Standard',
        _seedColorName: color.name,
        _seedColorHex: color.hexCode,
        price: basePrice,
        originalPrice: faker.datatype.boolean()
          ? basePrice + faker.number.int({ min: 5000, max: 300000 })
          : undefined,
        stockQuantity,
        isAvailable: stockQuantity > 0,
        images: [
          randomImage(`variant-${productIndex + 1}-${variantIndex + 1}-1`),
          randomImage(`variant-${productIndex + 1}-${variantIndex + 1}-2`)
        ]
      });
    }
  });

  const variants = await ProductVariantModel.insertMany(payloads);

  return variants.map((v, i) => ({
    _id: v._id as Types.ObjectId,
    productId: v.productId as Types.ObjectId,
    color: payloads[i]._seedColorName as string,
    colorHex: payloads[i]._seedColorHex as string | undefined,
    stockQuantity: payloads[i].stockQuantity as number,
    sku: payloads[i].sku as string,
    price: payloads[i].price as number,
    images: payloads[i].images as string[]
  }));
};

const seedInventoryLogs = async (
  variants: Array<{ _id: Types.ObjectId; productId: Types.ObjectId; stockQuantity: number }>,
  performerId?: Types.ObjectId
) => {
  if (!performerId || variants.length === 0) {
    return [];
  }

  const reason: InventoryReason = 'import';

  const payloads = variants.map((variant) => ({
    productId: variant.productId,
    variantId: variant._id,
    changeAmount: variant.stockQuantity,
    reason,
    performedBy: performerId,
    note: 'Initial stock from faker seed'
  }));

  return InventoryLogModel.insertMany(payloads);
};

const seedVouchers = async (count: number) => {
  if (count === 0) {
    return [];
  }

  const payloads = Array.from({ length: count }, () => {
    const discountType: VoucherDiscountType = faker.helpers.arrayElement([
      'percentage',
      'fixed_amount'
    ]);

    const usageLimit = faker.number.int({ min: 20, max: 500 });

    return {
      code: `SALE-${faker.string.alphanumeric(8).toUpperCase()}`,
      description: faker.lorem.sentence(),
      discountType,
      discountValue:
        discountType === 'percentage'
          ? faker.number.int({ min: 5, max: 40 })
          : faker.number.int({ min: 10000, max: 500000 }),
      minOrderValue: faker.number.int({ min: 0, max: 300000 }),
      maxDiscountAmount:
        discountType === 'percentage' ? faker.number.int({ min: 30000, max: 300000 }) : undefined,
      startDate: faker.date.recent({ days: 10 }),
      expirationDate: faker.date.soon({ days: 45 }),
      usageLimit,
      maxUsagePerUser: faker.number.int({ min: 1, max: usageLimit - 1 }),
      usedCount: faker.number.int({ min: 0, max: 10 }),
      isActive: true
    };
  });

  return VoucherModel.insertMany(payloads);
};

const seedCarts = async (
  count: number,
  customerIds: Types.ObjectId[],
  variants: Array<{ _id: Types.ObjectId; productId: Types.ObjectId; color: string }>
) => {
  if (count === 0 || customerIds.length === 0 || variants.length === 0) {
    return [];
  }

  const targetUsers = faker.helpers
    .shuffle([...customerIds])
    .slice(0, Math.min(count, customerIds.length));

  const payloads = targetUsers.map((userId) => {
    const selectedVariants = faker.helpers.arrayElements(
      variants,
      faker.number.int({ min: 1, max: Math.min(4, variants.length) })
    );

    return {
      userId,
      items: selectedVariants.map((variant) => ({
        productId: variant.productId,
        variantId: variant._id,
        quantity: faker.number.int({ min: 1, max: 5 }),
        selectedAttributes: {
          color: variant.color
        }
      }))
    };
  });

  return CartModel.insertMany(payloads);
};

const toTwoDecimals = (value: number) => Math.round(value * 100) / 100;

const seedOrders = async (
  count: number,
  customerIds: Types.ObjectId[],
  variants: Array<{
    _id: Types.ObjectId;
    productId: Types.ObjectId;
    sku: string;
    color: string;
    price: number;
    images: string[];
  }>,
  productNameById: Map<string, string>,
  vouchers: Array<{ _id: Types.ObjectId }> = []
) => {
  if (count === 0 || customerIds.length === 0 || variants.length === 0) {
    return [];
  }

  const statuses: OrderStatus[] = [
    'pending',
    'confirmed',
    'preparing',
    'shipping',
    'delivered',
    'cancelled'
  ];
  const paymentMethods: PaymentMethod[] = ['cod', 'banking', 'momo', 'vnpay'];

  const ordersPayload = Array.from({ length: count }, (_, index) => {
    const userId = faker.helpers.arrayElement(customerIds);
    const lineItems = faker.helpers.arrayElements(
      variants,
      faker.number.int({ min: 1, max: Math.min(3, variants.length) })
    );

    const items = lineItems.map((variant) => {
      const quantity = faker.number.int({ min: 1, max: 4 });
      const total = toTwoDecimals(variant.price * quantity);

      return {
        productId: variant.productId,
        productName: productNameById.get(String(variant.productId)) ?? 'Unknown Product',
        variantId: variant._id,
        variantSku: variant.sku,
        variantColor: variant.color,
        productImage: variant.images[0],
        quantity,
        price: variant.price,
        total
      };
    });

    const subtotal = toTwoDecimals(items.reduce((sum, item) => sum + item.total, 0));
    const shippingFee = faker.number.int({ min: 0, max: 50000 });
    const discountAmount = faker.datatype.boolean() ? faker.number.int({ min: 0, max: 50000 }) : 0;
    const totalAmount = Math.max(toTwoDecimals(subtotal + shippingFee - discountAmount), 0);
    const status = faker.helpers.arrayElement(statuses);
    const paymentStatus: PaymentStatus = status === 'delivered' ? 'paid' : 'pending';

    return {
      orderCode: `ORD-${Date.now()}-${index + 1}-${faker.number.int({ min: 1000, max: 9999 })}`,
      userId,
      shippingRecipientName: faker.person.fullName(),
      shippingPhone: faker.phone.number({ style: 'international' }),
      shippingAddress: `${faker.location.streetAddress()}, ${faker.location.city()}`,
      subtotal,
      shippingFee,
      discountAmount,
      totalAmount,
      paymentMethod: faker.helpers.arrayElement(paymentMethods),
      paymentStatus,
      voucherId:
        vouchers.length > 0 && faker.datatype.boolean()
          ? faker.helpers.arrayElement(vouchers)._id
          : undefined,
      status,
      items,
      statusHistory: [
        {
          status: 'pending' as OrderStatus,
          changedBy: userId,
          note: 'Order created by faker seed',
          changedAt: faker.date.recent({ days: 5 })
        },
        ...(status !== 'pending'
          ? [
              {
                status,
                changedBy: userId,
                note: 'Order progressed by faker seed',
                changedAt: faker.date.recent({ days: 2 })
              }
            ]
          : [])
      ]
    };
  });

  return OrderModel.insertMany(ordersPayload);
};

const seedReviews = async (
  count: number,
  deliveredOrders: Array<{
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    items: Array<{ productId: Types.ObjectId }>;
  }>
) => {
  if (count === 0 || deliveredOrders.length === 0) {
    return [];
  }

  const createdKeys = new Set<string>();
  const payloads: Array<Record<string, unknown>> = [];

  for (const order of faker.helpers.shuffle([...deliveredOrders])) {
    for (const item of order.items) {
      if (payloads.length >= count) {
        break;
      }

      const key = `${order._id.toString()}-${item.productId.toString()}`;

      if (createdKeys.has(key)) {
        continue;
      }

      payloads.push({
        productId: item.productId,
        userId: order.userId,
        orderId: order._id,
        rating: faker.number.int({ min: 3, max: 5 }),
        content: faker.lorem.sentences({ min: 1, max: 3 }),
        images: faker.datatype.boolean() ? [randomImage(`review-${payloads.length + 1}`)] : [],
        isPublished: true
      });

      createdKeys.add(key);
    }

    if (payloads.length >= count) {
      break;
    }
  }

  if (payloads.length === 0) {
    return [];
  }

  return ReviewModel.insertMany(payloads);
};

const updateProductStats = async () => {
  const reviewsByProduct = await ReviewModel.aggregate<{
    _id: Types.ObjectId;
    averageRating: number;
    reviewCount: number;
  }>([
    {
      $group: {
        _id: '$productId',
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 }
      }
    }
  ]);

  const soldCountByProduct = await OrderModel.aggregate<{
    _id: Types.ObjectId;
    soldCount: number;
  }>([
    {
      $match: {
        status: 'delivered'
      }
    },
    {
      $unwind: '$items'
    },
    {
      $group: {
        _id: '$items.productId',
        soldCount: { $sum: '$items.quantity' }
      }
    }
  ]);

  const reviewMap = new Map(reviewsByProduct.map((item) => [item._id.toString(), item]));
  const soldMap = new Map(soldCountByProduct.map((item) => [item._id.toString(), item.soldCount]));

  const products = await ProductModel.find({}, { _id: 1 });

  for (const product of products) {
    const productId = product._id.toString();
    const review = reviewMap.get(productId);

    await ProductModel.updateOne(
      { _id: product._id },
      {
        averageRating: review ? toTwoDecimals(review.averageRating) : 0,
        reviewCount: review?.reviewCount ?? 0,
        soldCount: soldMap.get(productId) ?? 0
      }
    );
  }
};

const main = async () => {
  const options = parseOptions();

  if (typeof options.seed === 'number') {
    faker.seed(options.seed);
  }

  await connectMongo();

  if (options.clear) {
    logger.info('Clearing collections before seed...');
    await clearCollections();
  }

  logger.info(`Seed options: ${JSON.stringify(options)}`);

  const users = await seedUsers(options.users);
  const customerUsers = users.filter((user) => user.role === 'customer');
  const staffOrAdmin = users.find((user) => user.role !== 'customer');

  await seedAddresses(customerUsers.map((user) => user._id as Types.ObjectId));

  let categories = await seedCategories(options.categories);

  if (categories.length === 0 && options.products > 0) {
    const fallback = await seedCategories(1);
    categories = fallback;
  }

  const products = await seedProducts(
    options.products,
    categories.map((category) => category._id)
  );

  const [colors, sizes] = await Promise.all([seedColors(), seedSizes()]);

  const variants = await seedVariants(
    products.map((product) => product._id as Types.ObjectId),
    options.variantsPerProduct,
    colors.map((c) => ({ _id: c._id as Types.ObjectId, name: c.name, hexCode: c.hexCode })),
    sizes.map((s) => ({ _id: s._id as Types.ObjectId, name: s.name }))
  );

  await seedInventoryLogs(
    variants.map((variant) => ({
      _id: variant._id as Types.ObjectId,
      productId: variant.productId as Types.ObjectId,
      stockQuantity: variant.stockQuantity as number
    })),
    (staffOrAdmin?._id as Types.ObjectId | undefined) ??
      (users[0]?._id as Types.ObjectId | undefined)
  );

  const vouchers = await seedVouchers(options.vouchers);

  await seedCarts(
    options.carts,
    customerUsers.map((user) => user._id as Types.ObjectId),
    variants.map((variant) => ({
      _id: variant._id as Types.ObjectId,
      productId: variant.productId as Types.ObjectId,
      color: variant.color as string
    }))
  );

  const productNameById = new Map(
    products.map((product) => [String(product._id), product.name] as const)
  );

  const orders = await seedOrders(
    options.orders,
    customerUsers.map((user) => user._id as Types.ObjectId),
    variants.map((variant) => ({
      _id: variant._id as Types.ObjectId,
      productId: variant.productId as Types.ObjectId,
      sku: variant.sku as string,
      color: variant.color as string,
      price: variant.price as number,
      images: variant.images as string[]
    })),
    productNameById,
    vouchers.map((voucher) => ({ _id: voucher._id as Types.ObjectId }))
  );

  await seedReviews(
    options.reviews,
    orders
      .filter((order) => order.status === 'delivered')
      .map((order) => ({
        _id: order._id as Types.ObjectId,
        userId: order.userId,
        items: order.items.map((item) => ({ productId: item.productId }))
      }))
  );

  await updateProductStats();

  logger.info('Seed completed successfully');
  logger.info(
    JSON.stringify(
      {
        users: users.length,
        categories: categories.length,
        products: products.length,
        variants: variants.length,
        vouchers: vouchers.length,
        carts: await CartModel.countDocuments(),
        orders: orders.length,
        reviews: await ReviewModel.countDocuments()
      },
      null,
      2
    )
  );
};

void main()
  .catch((error) => {
    logger.error(`Seed failed: ${(error as Error).stack ?? (error as Error).message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongo();
  });
