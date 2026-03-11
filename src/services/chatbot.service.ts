import { CategoryModel } from '@models/category.model';
import { ProductModel } from '@models/product.model';
import { ProductVariantModel } from '@models/product-variant.model';
import { Types } from 'mongoose';

type ChatbotIntent =
  | 'order_tracking'
  | 'payment'
  | 'shipping'
  | 'voucher'
  | 'return_refund'
  | 'recommendation'
  | 'general';

interface AskChatbotInput {
  question: string;
  context?: {
    path?: string;
  };
}

interface ChatbotAction {
  label: string;
  url: string;
}

interface ChatbotSuggestedProduct {
  id: string;
  name: string;
  brand: string;
  imageUrl: string | null;
  priceFrom: number | null;
  soldCount: number;
  averageRating: number;
  url: string;
}

interface AskChatbotResult {
  intent: ChatbotIntent;
  answer: string;
  actions: ChatbotAction[];
  followUpQuestions: string[];
  suggestedProducts: ChatbotSuggestedProduct[];
}

interface ProductSuggestionSnapshot {
  _id: unknown;
  name?: string;
  brand?: string;
  images?: string[];
  soldCount?: number;
  averageRating?: number;
}

interface CategorySnapshot {
  name?: string;
}

const STOP_WORDS = new Set([
  'toi',
  'minh',
  'la',
  'va',
  'hoac',
  'cho',
  've',
  'co',
  'khong',
  'can',
  'duoc',
  'nhu',
  'nao',
  'gi',
  'di',
  'den',
  'tren',
  'duoi',
  'mot',
  'nhung',
  'vui',
  'long',
  'shop',
  'cua',
  'hang',
  'em',
  'anh',
  'chi'
]);

const parseBudgetFromQuestion = (question: string) => {
  const normalized = normalizeText(question).replace(/,/g, '.');
  const budgetPatterns = [
    /(?:duoi|toi da|max)\s+(\d+(?:\.\d+)?)\s*(trieu|m|nghin|ngan|k)?/,
    /(\d+(?:\.\d+)?)\s*(trieu|m|nghin|ngan|k)\s*(?:tro xuong|tro lai|duoi)?/
  ];

  for (const pattern of budgetPatterns) {
    const matched = normalized.match(pattern);

    if (!matched) {
      continue;
    }

    const rawValue = Number.parseFloat(matched[1]);

    if (!Number.isFinite(rawValue) || rawValue <= 0) {
      continue;
    }

    const unit = matched[2];

    if (unit === 'trieu' || unit === 'm') {
      return Math.round(rawValue * 1_000_000);
    }

    if (unit === 'nghin' || unit === 'ngan' || unit === 'k') {
      return Math.round(rawValue * 1_000);
    }

    return Math.round(rawValue);
  }

  return undefined;
};

const formatCurrencyVnd = (value: number) => {
  return `${value.toLocaleString('vi-VN')} đ`;
};

const normalizeText = (value: string) => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

const escapeRegex = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const includesAny = (normalizedQuestion: string, keywords: string[]) => {
  return keywords.some((keyword) => normalizedQuestion.includes(keyword));
};

const detectIntent = (normalizedQuestion: string): ChatbotIntent => {
  if (
    includesAny(normalizedQuestion, [
      'don hang',
      'trang thai don',
      'ma don',
      'theo doi don',
      'kiem tra don'
    ])
  ) {
    return 'order_tracking';
  }

  if (
    includesAny(normalizedQuestion, [
      'thanh toan',
      'vnpay',
      'momo',
      'chuyen khoan',
      'cod',
      'tra gop'
    ])
  ) {
    return 'payment';
  }

  if (
    includesAny(normalizedQuestion, [
      'giao hang',
      'van chuyen',
      'ship',
      'phi ship',
      'thoi gian giao'
    ])
  ) {
    return 'shipping';
  }

  if (
    includesAny(normalizedQuestion, [
      'voucher',
      'ma giam',
      'giam gia',
      'khuyen mai',
      'uu dai'
    ])
  ) {
    return 'voucher';
  }

  if (
    includesAny(normalizedQuestion, [
      'doi tra',
      'hoan tien',
      'huy don',
      'bao hanh',
      'tra hang'
    ])
  ) {
    return 'return_refund';
  }

  if (
    includesAny(normalizedQuestion, [
      'goi y',
      'tu van',
      'san pham',
      'mua',
      'ban chay',
      'chon'
    ])
  ) {
    return 'recommendation';
  }

  return 'general';
};

const extractKeywords = (question: string) => {
  const normalized = normalizeText(question).replace(/[^a-z0-9\s]/g, ' ');
  const deduped = new Set<string>();

  for (const token of normalized.split(/\s+/g)) {
    if (!token || token.length < 2 || STOP_WORDS.has(token)) {
      continue;
    }

    deduped.add(token);

    if (deduped.size >= 5) {
      break;
    }
  }

  return Array.from(deduped);
};

const fetchSuggestedProducts = async (input: { keywords: string[]; maxPrice?: number }) => {
  const { keywords, maxPrice } = input;
  const baseFilter: Record<string, unknown> = {
    isAvailable: true
  };

  let productIdsFromBudget: string[] | undefined;
  let minPriceByProductId = new Map<string, number>();

  if (typeof maxPrice === 'number' && Number.isFinite(maxPrice) && maxPrice > 0) {
    const variantPrices = (await ProductVariantModel.aggregate([
      {
        $match: {
          isAvailable: true,
          stockQuantity: {
            $gt: 0
          }
        }
      },
      {
        $group: {
          _id: '$productId',
          minPrice: {
            $min: '$price'
          }
        }
      },
      {
        $match: {
          minPrice: {
            $lte: maxPrice
          }
        }
      },
      {
        $sort: {
          minPrice: 1
        }
      }
    ])) as Array<{ _id: unknown; minPrice: number }>;

    productIdsFromBudget = variantPrices.map((item) => String(item._id));
    minPriceByProductId = new Map(
      variantPrices.map((item) => [String(item._id), Number(item.minPrice)])
    );

    if (productIdsFromBudget.length === 0) {
      return [];
    }

    baseFilter._id = {
      $in: productIdsFromBudget
    };
  }

  if (keywords.length > 0) {
    const pattern = keywords.map((keyword) => escapeRegex(keyword)).join('|');
    const regex = new RegExp(pattern, 'i');

    baseFilter.$or = [{ name: { $regex: regex } }, { brand: { $regex: regex } }];
  }

  let products = (await ProductModel.find(baseFilter)
    .sort(keywords.length > 0 ? { soldCount: -1, averageRating: -1, updatedAt: -1 } : { soldCount: -1 })
    .limit(4)
    .select('name brand images soldCount averageRating')
    .lean()) as ProductSuggestionSnapshot[];

  if (products.length === 0 && keywords.length > 0) {
    const fallbackFilter: Record<string, unknown> = {
      isAvailable: true
    };

    if (productIdsFromBudget && productIdsFromBudget.length > 0) {
      fallbackFilter._id = {
        $in: productIdsFromBudget
      };
    }

    products = (await ProductModel.find(fallbackFilter)
      .sort({ soldCount: -1, averageRating: -1, updatedAt: -1 })
      .limit(4)
      .select('name brand images soldCount averageRating')
      .lean()) as ProductSuggestionSnapshot[];
  }

  if (products.length > 0 && minPriceByProductId.size === 0) {
    const productIds = products.map((product) => String(product._id));
    const variantPrices = (await ProductVariantModel.aggregate([
      {
        $match: {
          isAvailable: true,
          stockQuantity: {
            $gt: 0
          },
          productId: {
            $in: productIds.map((id) => new Types.ObjectId(id))
          }
        }
      },
      {
        $group: {
          _id: '$productId',
          minPrice: {
            $min: '$price'
          }
        }
      }
    ])) as Array<{ _id: unknown; minPrice: number }>;

    minPriceByProductId = new Map(
      variantPrices.map((item) => [String(item._id), Number(item.minPrice)])
    );
  }

  return products.map((product) => ({
    id: String(product._id ?? ''),
    name: product.name ?? 'Sản phẩm',
    brand: product.brand ?? 'Generic',
    imageUrl: Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null,
    priceFrom: minPriceByProductId.get(String(product._id ?? '')) ?? null,
    soldCount: Number(product.soldCount ?? 0),
    averageRating: Number(product.averageRating ?? 0),
    url: `/products/${String(product._id ?? '')}`
  }));
};

const buildIntentResponse = async (
  intent: ChatbotIntent,
  suggestedProducts: ChatbotSuggestedProduct[],
  contextPath?: string,
  maxPrice?: number
) => {
  switch (intent) {
    case 'order_tracking':
      return {
        answer:
          'Bạn có thể theo dõi trạng thái đơn trong mục "Đơn hàng của tôi". Hệ thống sẽ cập nhật tự động theo từng bước xử lý.',
        actions: [
          { label: 'Xem đơn hàng', url: '/account/orders' },
          { label: 'Đăng nhập', url: '/login' }
        ],
        followUpQuestions: ['Đơn của tôi đang ở trạng thái nào?', 'Làm sao để hủy đơn hàng?']
      };
    case 'payment':
      return {
        answer:
          'Hiện cửa hàng hỗ trợ COD, chuyển khoản, MoMo và VNPay. Bạn có thể chọn phương thức thanh toán tại trang checkout.',
        actions: [
          { label: 'Đi tới checkout', url: '/checkout' },
          { label: 'Xem giỏ hàng', url: '/' }
        ],
        followUpQuestions: ['Thanh toán VNPay bị lỗi thì làm sao?', 'COD có phụ phí không?']
      };
    case 'shipping':
      return {
        answer:
          'Thời gian giao hàng thường từ 1-5 ngày tùy khu vực. Phí ship sẽ hiển thị rõ trước khi bạn xác nhận đặt hàng.',
        actions: [
          { label: 'Xem sản phẩm', url: '/products' },
          { label: 'Theo dõi đơn hàng', url: '/account/orders' }
        ],
        followUpQuestions: ['Đơn hàng có giao nhanh không?', 'Có miễn phí vận chuyển không?']
      };
    case 'voucher':
      return {
        answer:
          'Bạn có thể áp dụng voucher tại trang checkout. Hệ thống sẽ tự kiểm tra điều kiện đơn tối thiểu và giới hạn sử dụng.',
        actions: [
          { label: 'Mua ngay', url: '/products' },
          { label: 'Đi tới checkout', url: '/checkout' }
        ],
        followUpQuestions: ['Mã giảm giá của tôi không áp dụng được?', 'Voucher còn bao nhiêu lượt?']
      };
    case 'return_refund':
      return {
        answer:
          'Bạn có thể yêu cầu hủy đơn khi đơn chưa giao, hoặc liên hệ hỗ trợ để xử lý đổi/trả tùy tình trạng sản phẩm.',
        actions: [
          { label: 'Xem đơn hàng', url: '/account/orders' },
          { label: 'Xem chính sách', url: '/about' }
        ],
        followUpQuestions: ['Khi nào tôi được hoàn tiền?', 'Đơn đã giao có thể đổi trả không?']
      };
    case 'recommendation':
      return {
        answer:
          suggestedProducts.length > 0
            ? maxPrice
              ? `Mình đã lọc các sản phẩm còn hàng trong ngân sách dưới ${formatCurrencyVnd(maxPrice)}.`
              : 'Mình đã tìm thấy một số sản phẩm phù hợp và đang được quan tâm.'
            : maxPrice
              ? `Hiện chưa có sản phẩm phù hợp dưới ${formatCurrencyVnd(maxPrice)}. Bạn có thể tăng nhẹ ngân sách để có thêm lựa chọn.`
              : 'Bạn có thể mô tả rõ hơn nhu cầu (tầm giá, loại sản phẩm, mục đích dùng) để mình gợi ý chính xác hơn.',
        actions: [
          { label: 'Xem toàn bộ sản phẩm', url: '/products' },
          { label: 'Sản phẩm mới nhất', url: '/products?sort=newest' }
        ],
        followUpQuestions: [
          'Có sản phẩm bán chạy nào không?',
          'Gợi ý theo ngân sách dưới 2 triệu',
          'Sản phẩm nào phù hợp người mới chơi?'
        ]
      };
    case 'general':
    default: {
      const topCategories = (await CategoryModel.find({ isActive: true })
        .sort({ updatedAt: -1 })
        .limit(4)
        .select('name')
        .lean()) as CategorySnapshot[];
      const categoryText = topCategories
        .map((item) => item.name?.trim())
        .filter(Boolean)
        .join(', ');

      return {
        answer:
          categoryText.length > 0
            ? `Mình có thể hỗ trợ tư vấn sản phẩm, thanh toán, vận chuyển và đơn hàng. Một số danh mục nổi bật hiện tại: ${categoryText}.`
            : 'Mình có thể hỗ trợ tư vấn sản phẩm, thanh toán, vận chuyển và đơn hàng.',
        actions: [
          { label: 'Khám phá sản phẩm', url: '/products' },
          {
            label: contextPath?.startsWith('/products') ? 'Trang sản phẩm hiện tại' : 'Xem chính sách',
            url: contextPath?.startsWith('/products') ? contextPath : '/about'
          }
        ],
        followUpQuestions: ['Gợi ý sản phẩm bán chạy', 'Hướng dẫn theo dõi đơn hàng']
      };
    }
  }
};

export const askChatbot = async (input: AskChatbotInput): Promise<AskChatbotResult> => {
  const normalizedQuestion = normalizeText(input.question);
  const intent = detectIntent(normalizedQuestion);
  const keywords = extractKeywords(input.question);
  const maxPrice = parseBudgetFromQuestion(input.question);

  const shouldLoadSuggestions =
    intent === 'recommendation' || (keywords.length > 0 && intent !== 'order_tracking');

  const suggestedProducts = shouldLoadSuggestions
    ? await fetchSuggestedProducts({
        keywords,
        maxPrice
      })
    : ([] as ChatbotSuggestedProduct[]);

  const responseTemplate = await buildIntentResponse(
    intent,
    suggestedProducts,
    input.context?.path,
    maxPrice
  );

  return {
    intent,
    answer: responseTemplate.answer,
    actions: responseTemplate.actions,
    followUpQuestions: responseTemplate.followUpQuestions,
    suggestedProducts
  };
};
