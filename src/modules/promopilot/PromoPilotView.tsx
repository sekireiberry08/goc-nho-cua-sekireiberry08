"use client";

import React, { useState, useMemo } from "react";
import {
  Sparkles,
  ShoppingBag,
  Ticket,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Minus,
  Coins,
  Clock,
  Wallet,
  Send,
  Upload,
  Zap,
  ArrowRight,
  Info,
  ShieldAlert,
} from "lucide-react";

// ==========================================
// 1. ĐỊNH NGHĨA KIỂU DỮ LIỆU (TYPES)
// ==========================================
type Category = "COFFEE" | "FREEZE" | "TEA" | "FOOD";
type PaymentMethod = "ANY" | "WALLET_BALANCE" | "PAYLATER_WALLET";

interface MenuItem {
  id: string;
  name: string;
  category: Category;
  price: number;
  isUpsellCandidate?: boolean;
  tag?: string;
}

interface VoucherRule {
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxDiscountCap: number;
  minOrderValue: number;
  excludedCategories: Category[];
  validHours: [number, number]; // [startHour, endHour]
  requiredPaymentMethod: PaymentMethod;
}

interface Voucher {
  id: string;
  code: string;
  title: string;
  acquisitionType: "OWNED" | "COIN_REDEEM";
  coinCost: number;
  rawTerms: string;
  hiddenTraps: string[];
  rules: VoucherRule;
}

interface EvaluatedVoucher {
  voucher: Voucher;
  isEligible: boolean;
  reasons: string[];
  discountAmount: number;
  effectiveSavings: number; // Đã trừ chi phí quy đổi Xu (1 Xu = 100đ)
}

// ==========================================
// 2. DỮ LIỆU MẪU HIGHLANDS COFFEE & 8 VOUCHER BẪY
// ==========================================
const MENU_ITEMS: MenuItem[] = [
  {
    id: "hl_1",
    name: "Phin Sữa Đá (Size M)",
    category: "COFFEE",
    price: 39000,
    tag: "Best Seller",
  },
  { id: "hl_2", name: "Bạc Xỉu Đá (Size M)", category: "COFFEE", price: 39000 },
  {
    id: "hl_3",
    name: "Freeze Trà Xanh (Size M)",
    category: "FREEZE",
    price: 55000,
    tag: "Đá Xay",
  },
  {
    id: "hl_4",
    name: "Cookies & Cream (Size M)",
    category: "FREEZE",
    price: 55000,
    tag: "Đá Xay",
  },
  {
    id: "hl_5",
    name: "Trà Sen Vàng (Size M)",
    category: "TEA",
    price: 45000,
    tag: "Hot",
  },
  { id: "hl_6", name: "Trà Thạch Đào (Size M)", category: "TEA", price: 45000 },
  {
    id: "hl_7",
    name: "Bánh Mì Que Pate",
    category: "FOOD",
    price: 19000,
    isUpsellCandidate: true,
    tag: "Món kèm",
  },
  {
    id: "hl_8",
    name: "Bánh Phô Mai Chanh Dây",
    category: "FOOD",
    price: 29000,
    isUpsellCandidate: true,
  },
];

const INITIAL_VOUCHERS: Voucher[] = [
  {
    id: "v1",
    code: "HL30_HAPPY",
    title: "Giảm 30% tối đa 25K đơn từ 79K",
    acquisitionType: "OWNED",
    coinCost: 0,
    rawTerms:
      "Giảm 30% tối đa 25.000đ cho hóa đơn từ 79.000đ. Không áp dụng cho dòng Freeze (Đá xay) và Bánh. Chỉ áp dụng khung giờ 14:00 - 17:00.",
    hiddenTraps: ["Loại trừ Freeze & Bánh", "Chỉ dùng 14:00 - 17:00"],
    rules: {
      discountType: "PERCENTAGE",
      discountValue: 30,
      maxDiscountCap: 25000,
      minOrderValue: 79000,
      excludedCategories: ["FREEZE", "FOOD"],
      validHours: [14, 17],
      requiredPaymentMethod: "ANY",
    },
  },
  {
    id: "v2",
    code: "PAYLATER_40K",
    title: "Giảm thẳng 40K cho đơn từ 99K",
    acquisitionType: "COIN_REDEEM",
    coinCost: 150,
    rawTerms:
      "Đổi 150 Xu lấy mã giảm 40.000đ cho đơn từ 99.000đ. Bắt buộc thanh toán qua nguồn tiền Ví Trả Sau.",
    hiddenTraps: ["Tốn 150 Xu (~15K)", "Bắt buộc Ví Trả Sau"],
    rules: {
      discountType: "FIXED_AMOUNT",
      discountValue: 40000,
      maxDiscountCap: 40000,
      minOrderValue: 99000,
      excludedCategories: [],
      validHours: [0, 24],
      requiredPaymentMethod: "PAYLATER_WALLET",
    },
  },
  {
    id: "v3",
    code: "FREEZE_LOVER",
    title: "Giảm 50% tối đa 30K dòng Freeze",
    acquisitionType: "OWNED",
    coinCost: 0,
    rawTerms:
      "Giảm 50% tối đa 30.000đ chỉ tính trên các sản phẩm thuộc nhóm Freeze (Đá xay), đơn tối thiểu 55.000đ.",
    hiddenTraps: ["Chỉ tính tiền món Freeze", "Không giảm Cà phê/Trà"],
    rules: {
      discountType: "PERCENTAGE",
      discountValue: 50,
      maxDiscountCap: 30000,
      minOrderValue: 55000,
      excludedCategories: ["COFFEE", "TEA", "FOOD"],
      validHours: [0, 24],
      requiredPaymentMethod: "ANY",
    },
  },
  {
    id: "v4",
    code: "MORNING_15K",
    title: "Giảm 15K chào buổi sáng (Đơn từ 50K)",
    acquisitionType: "OWNED",
    coinCost: 0,
    rawTerms:
      "Giảm 15.000đ cho mọi hóa đơn từ 50.000đ trong khung giờ sáng 07:00 - 11:00.",
    hiddenTraps: ["Chỉ dùng 07:00 - 11:00"],
    rules: {
      discountType: "FIXED_AMOUNT",
      discountValue: 15000,
      maxDiscountCap: 15000,
      minOrderValue: 50000,
      excludedCategories: [],
      validHours: [7, 11],
      requiredPaymentMethod: "ANY",
    },
  },
  {
    id: "v5",
    code: "MOMO_XU_20K",
    title: "Đổi 100 Xu giảm 20K đơn từ 69K",
    acquisitionType: "COIN_REDEEM",
    coinCost: 100,
    rawTerms:
      "Dùng 100 Xu đổi mã giảm 20.000đ cho đơn từ 69.000đ. Áp dụng toàn menu, mọi khung giờ.",
    hiddenTraps: ["Tốn 100 Xu (~10K)"],
    rules: {
      discountType: "FIXED_AMOUNT",
      discountValue: 20000,
      maxDiscountCap: 20000,
      minOrderValue: 69000,
      excludedCategories: [],
      validHours: [0, 24],
      requiredPaymentMethod: "ANY",
    },
  },
  {
    id: "v6",
    code: "TEA_COMBO_25",
    title: "Giảm 25% tối đa 20K nhóm Trà",
    acquisitionType: "OWNED",
    coinCost: 0,
    rawTerms:
      "Giảm 25% tối đa 20.000đ cho hóa đơn từ 80.000đ. Không áp dụng Cà phê và Freeze.",
    hiddenTraps: ["Loại trừ Cà phê & Freeze"],
    rules: {
      discountType: "PERCENTAGE",
      discountValue: 25,
      maxDiscountCap: 20000,
      minOrderValue: 80000,
      excludedCategories: ["COFFEE", "FREEZE"],
      validHours: [0, 24],
      requiredPaymentMethod: "ANY",
    },
  },
  {
    id: "v7",
    code: "BIG_ORDER_50K",
    title: "Giảm 50K cho nhóm bạn (Đơn từ 160K)",
    acquisitionType: "COIN_REDEEM",
    coinCost: 250,
    rawTerms:
      "Đổi 250 Xu giảm 50.000đ cho hóa đơn từ 160.000đ. Thanh toán qua Số dư Ví.",
    hiddenTraps: ["Tốn 250 Xu (~25K)", "Đơn tối thiểu 160K"],
    rules: {
      discountType: "FIXED_AMOUNT",
      discountValue: 50000,
      maxDiscountCap: 50000,
      minOrderValue: 160000,
      excludedCategories: [],
      validHours: [0, 24],
      requiredPaymentMethod: "WALLET_BALANCE",
    },
  },
  {
    id: "v8",
    code: "SAFE_10K",
    title: "Giảm 10K mọi đơn từ 39K",
    acquisitionType: "OWNED",
    coinCost: 0,
    rawTerms:
      "Giảm trực tiếp 10.000đ cho đơn từ 39.000đ. Áp dụng cả ngày, mọi món.",
    hiddenTraps: ["Mức giảm thấp (10K)"],
    rules: {
      discountType: "FIXED_AMOUNT",
      discountValue: 10000,
      maxDiscountCap: 10000,
      minOrderValue: 39000,
      excludedCategories: [],
      validHours: [0, 24],
      requiredPaymentMethod: "ANY",
    },
  },
];

// ==========================================
// 3. HÀM TÍNH TOÁN & TỐI ƯU VOUCHER (RULE ENGINE)
// ==========================================
function evaluateVouchers(
  cart: Record<string, number>,
  vouchers: Voucher[],
  currentHour: number,
  paymentMethod: PaymentMethod,
  userCoins: number,
): EvaluatedVoucher[] {
  return vouchers.map((v) => {
    const reasons: string[] = [];

    // 1. Kiểm tra đủ Xu để đổi không
    if (v.acquisitionType === "COIN_REDEEM" && userCoins < v.coinCost) {
      reasons.push(`Thiếu Xu (Cần ${v.coinCost} Xu, bạn có ${userCoins} Xu)`);
    }

    // 2. Kiểm tra khung giờ
    const [startH, endH] = v.rules.validHours;
    if (currentHour < startH || currentHour >= endH) {
      reasons.push(
        `Sai khung giờ (Chỉ áp dụng ${startH}:00 - ${endH}:00, hiện tại ${currentHour}:00)`,
      );
    }

    // 3. Kiểm tra nguồn tiền thanh toán
    if (
      v.rules.requiredPaymentMethod !== "ANY" &&
      v.rules.requiredPaymentMethod !== paymentMethod
    ) {
      const reqName =
        v.rules.requiredPaymentMethod === "PAYLATER_WALLET"
          ? "Ví Trả Sau"
          : "Số dư Ví";
      reasons.push(`Yêu cầu thanh toán bằng ${reqName}`);
    }

    // 4. Tính tổng tiền các món HỢP LỆ (đã loại trừ danh mục bị cấm trong điều khoản ẩn)
    let eligibleSubtotal = 0;
    let excludedSubtotal = 0;
    Object.entries(cart).forEach(([itemId, qty]) => {
      if (qty <= 0) return;
      const item = MENU_ITEMS.find((m) => m.id === itemId);
      if (!item) return;
      if (v.rules.excludedCategories.includes(item.category)) {
        excludedSubtotal += item.price * qty;
      } else {
        eligibleSubtotal += item.price * qty;
      }
    });

    if (eligibleSubtotal < v.rules.minOrderValue) {
      const missing = v.rules.minOrderValue - eligibleSubtotal;
      if (excludedSubtotal > 0) {
        reasons.push(
          `Thiếu ${missing.toLocaleString("vi-VN")}đ món hợp lệ (Do ${excludedSubtotal.toLocaleString("vi-VN")}đ thuộc nhóm bị loại trừ)`,
        );
      } else {
        reasons.push(
          `Chưa đạt đơn tối thiểu ${v.rules.minOrderValue.toLocaleString("vi-VN")}đ (Thiếu ${missing.toLocaleString("vi-VN")}đ)`,
        );
      }
    }

    const isEligible = reasons.length === 0;
    let discountAmount = 0;

    if (isEligible) {
      if (v.rules.discountType === "FIXED_AMOUNT") {
        discountAmount = Math.min(v.rules.discountValue, eligibleSubtotal);
      } else {
        const rawDiscount = Math.floor(
          (eligibleSubtotal * v.rules.discountValue) / 100,
        );
        discountAmount = Math.min(
          rawDiscount,
          v.rules.maxDiscountCap,
          eligibleSubtotal,
        );
      }
    }

    // Quy đổi giá trị Xu (1 Xu = 100đ) để đánh giá độ "hời" thực sự
    const coinOpportunityCost = v.coinCost * 100;
    const effectiveSavings = isEligible
      ? discountAmount - coinOpportunityCost
      : -999999;

    return {
      voucher: v,
      isEligible,
      reasons,
      discountAmount,
      effectiveSavings,
    };
  });
}

// ==========================================
// 4. COMPONENT CHÍNH CỦA ỨNG DỤNG
// ==========================================
export default function PromoPilotPage() {
  // State giỏ hàng & ngữ cảnh
  const [cart, setCart] = useState<Record<string, number>>({ hl_1: 2 }); // Mặc định 2 Phin Sữa Đá = 78k
  const [currentHour, setCurrentHour] = useState<number>(15); // 15:00 chiều
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("PAYLATER_WALLET");
  const [userCoins, setUserCoins] = useState<number>(420);
  const [vouchers, setVouchers] = useState<Voucher[]>(INITIAL_VOUCHERS);

  // State UI tương tác
  const [chatInput, setChatInput] = useState<string>("");
  const [showIngestModal, setShowIngestModal] = useState<boolean>(false);
  const [rawNewTerms, setRawNewTerms] = useState<string>("");
  const [checkoutSuccess, setCheckoutSuccess] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<string>("preset_2");

  // Cập nhật số lượng món
  const updateQty = (id: string, delta: number) => {
    setCheckoutSuccess(false);
    setCart((prev) => {
      const nextQty = (prev[id] || 0) + delta;
      if (nextQty <= 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: nextQty };
    });
  };

  // 3 Kịch bản Demo 1-Click cho Ban Giám Khảo
  const applyPreset = (presetId: string) => {
    setCheckoutSuccess(false);
    setActivePreset(presetId);
    if (presetId === "preset_1") {
      // Kịch bản 1: Dính bẫy Freeze (2 Freeze Trà Xanh = 110k, mã HL30 tưởng dùng được nhưng bị loại)
      setCart({ hl_3: 2 });
      setCurrentHour(15);
      setPaymentMethod("WALLET_BALANCE");
    } else if (presetId === "preset_2") {
      // Kịch bản 2: 2 Phin Sữa Đá = 78k (thiếu 1k đạt 79k, và thêm 1 Bánh Mì Que 19k -> 97k, thêm 1 Bánh nữa chạm 99k giảm 40k!)
      setCart({ hl_1: 2, hl_7: 1 }); // 78k + 19k = 97k (thiếu đúng 2k đạt 99k của mã 40K!)
      setCurrentHour(15);
      setPaymentMethod("PAYLATER_WALLET");
    } else if (presetId === "preset_3") {
      // Kịch bản 3: Phân vân dùng mã có sẵn hay trích Xu đổi mã
      setCart({ hl_5: 2 }); // 2 Trà Sen Vàng = 90k
      setCurrentHour(20); // Buổi tối (mã chiều 14-17h hết hiệu lực)
      setPaymentMethod("WALLET_BALANCE");
    }
  };

  // Xử lý câu lệnh tự nhiên đơn giản từ thanh chat
  const handleNaturalPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const text = chatInput.toLowerCase();
    const newCart: Record<string, number> = {};

    if (text.includes("phin") || text.includes("cà phê")) newCart["hl_1"] = 2;
    if (text.includes("freeze") || text.includes("đá xay")) newCart["hl_3"] = 1;
    if (text.includes("trà sen")) newCart["hl_5"] = 2;
    if (text.includes("bánh mì")) newCart["hl_7"] = 1;
    if (text.includes("sáng")) setCurrentHour(9);
    if (text.includes("chiều")) setCurrentHour(15);
    if (text.includes("tối")) setCurrentHour(20);

    if (Object.keys(newCart).length > 0) {
      setCart(newCart);
    }
    setChatInput("");
    setCheckoutSuccess(false);
  };

  // Giả lập Policy-Parser Agent bóc tách điều khoản mới từ text/ảnh
  const handleParseNewVoucher = () => {
    if (!rawNewTerms.trim()) return;
    const text = rawNewTerms.toLowerCase();
    const isFreezeExcluded =
      text.includes("không áp dụng freeze") || text.includes("trừ đá xay");
    const minMatch = text.match(/(\d+)\s*k/);
    const minOrder = minMatch ? parseInt(minMatch[1]) * 1000 : 80000;

    const newVoucher: Voucher = {
      id: `custom_${Date.now()}`,
      code: "AI_PARSED_NEW",
      title: "Ưu đãi mới (AI vừa trích xuất từ điều khoản)",
      acquisitionType: "OWNED",
      coinCost: 0,
      rawTerms: rawNewTerms,
      hiddenTraps: [
        isFreezeExcluded
          ? "AI phát hiện: Loại trừ Freeze"
          : "Áp dụng toàn menu",
        `Đơn tối thiểu ${minOrder.toLocaleString("vi-VN")}đ`,
      ],
      rules: {
        discountType: "FIXED_AMOUNT",
        discountValue: 35000,
        maxDiscountCap: 35000,
        minOrderValue: minOrder,
        excludedCategories: isFreezeExcluded ? ["FREEZE"] : [],
        validHours: [0, 24],
        requiredPaymentMethod: "ANY",
      },
    };

    setVouchers((prev) => [newVoucher, ...prev]);
    setRawNewTerms("");
    setShowIngestModal(false);
  };

  // Tính tổng tiền giỏ hàng hiện tại
  const subtotal = useMemo(() => {
    return Object.entries(cart).reduce((sum, [id, qty]) => {
      const item = MENU_ITEMS.find((m) => m.id === id);
      return sum + (item ? item.price * qty : 0);
    }, 0);
  }, [cart]);

  // Đánh giá toàn bộ voucher cho giỏ hàng hiện tại
  const evaluatedList = useMemo(() => {
    return evaluateVouchers(
      cart,
      vouchers,
      currentHour,
      paymentMethod,
      userCoins,
    ).sort((a, b) => b.effectiveSavings - a.effectiveSavings);
  }, [cart, vouchers, currentHour, paymentMethod, userCoins]);

  const bestCurrent = evaluatedList.find((e) => e.isEligible) || null;
  const currentFinalPrice =
    subtotal - (bestCurrent ? bestCurrent.discountAmount : 0);

  // Thuật toán Smart Upsell: Thử thêm 1 món giá rẻ xem tổng tiền phải trả có RẺ HƠN hiện tại không
  const upsellRecommendation = useMemo(() => {
    if (subtotal === 0) return null;
    let bestUpsell: {
      addedItem: MenuItem;
      newSubtotal: number;
      bestVoucher: EvaluatedVoucher;
      newFinalPrice: number;
      netGain: number;
    } | null = null;

    const candidates = MENU_ITEMS.filter((m) => m.isUpsellCandidate);
    for (const item of candidates) {
      const simulatedCart = { ...cart, [item.id]: (cart[item.id] || 0) + 1 };
      const simSubtotal = subtotal + item.price;
      const simEval = evaluateVouchers(
        simulatedCart,
        vouchers,
        currentHour,
        paymentMethod,
        userCoins,
      ).sort((a, b) => b.effectiveSavings - a.effectiveSavings);

      const simBest = simEval.find((e) => e.isEligible);
      if (simBest) {
        const simFinal = simSubtotal - simBest.discountAmount;
        if (simFinal < currentFinalPrice) {
          const netGain = currentFinalPrice - simFinal;
          if (!bestUpsell || netGain > bestUpsell.netGain) {
            bestUpsell = {
              addedItem: item,
              newSubtotal: simSubtotal,
              bestVoucher: simBest,
              newFinalPrice: simFinal,
              netGain,
            };
          }
        }
      }
    }
    return bestUpsell;
  }, [
    cart,
    subtotal,
    vouchers,
    currentHour,
    paymentMethod,
    userCoins,
    currentFinalPrice,
  ]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* ==========================================
          TOP BAR: THANH ĐIỀU KHIỂN & KỊCH BẢN DEMO
         ========================================== */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-6 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-600 flex items-center justify-center text-white font-bold shadow-md shadow-pink-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-slate-900">
                  MoMo PromoPilot AI
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">
                  Tech Contest 2026
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Trợ lý AI soi điều khoản ẩn & tối ưu tổ hợp Xu + Voucher thanh
                toán
              </p>
            </div>
          </div>

          {/* 3 Nút kịch bản test nhanh cho BGK */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500 mr-1">
              Kịch bản mẫu:
            </span>
            <button
              onClick={() => applyPreset("preset_1")}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
                activePreset === "preset_1"
                  ? "bg-pink-600 text-white border-pink-600"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              1. Dính bẫy Freeze
            </button>
            <button
              onClick={() => applyPreset("preset_2")}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
                activePreset === "preset_2"
                  ? "bg-pink-600 text-white border-pink-600"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              2. Bù 19K giảm thêm 25K
            </button>
            <button
              onClick={() => applyPreset("preset_3")}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
                activePreset === "preset_3"
                  ? "bg-pink-600 text-white border-pink-600"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              3. Đổi Xu hay dùng mã sẵn?
            </button>
            <button
              onClick={() => setShowIngestModal(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 flex items-center gap-1.5 ml-2"
            >
              <Upload className="w-3.5 h-3.5" /> Nạp Voucher Thật
            </button>
          </div>
        </div>
      </header>

      {/* ==========================================
          THANH GIẢ LẬP NGỮ CẢNH (GIỜ & NGUỒN TIỀN)
         ========================================== */}
      <div className="bg-slate-900 text-slate-200 px-6 py-2.5 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-pink-400" />
              <span>Giờ đặt đơn giả lập:</span>
              <select
                value={currentHour}
                onChange={(e) => setCurrentHour(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white font-medium"
              >
                <option value={9}>09:00 (Buổi sáng)</option>
                <option value={15}>15:00 (Khung giờ vàng 14h-17h)</option>
                <option value={20}>20:00 (Buổi tối)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-pink-400" />
              <span>Nguồn tiền:</span>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as PaymentMethod)
                }
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white font-medium"
              >
                <option value="PAYLATER_WALLET">Ví Trả Sau</option>
                <option value="WALLET_BALANCE">Số dư Ví MoMo</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>Ví Xu của bạn:</span>
            <strong className="text-amber-400">{userCoins} Xu</strong>
            <span className="text-slate-400">
              (~{(userCoins * 100).toLocaleString("vi-VN")}đ)
            </span>
          </div>
        </div>
      </div>

      {/* ==========================================
          BỐ CỤC CHÍNH 3 CỘT (MAIN WORKSPACE)
         ========================================== */}
      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* CỘT 1: MENU HIGHLANDS COFFEE & CHAT INPUT (4 CỘT) */}
        <section className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-red-700" />
                Menu Highlands Coffee
              </h2>
              <span className="text-xs text-slate-500">Chọn món muốn gọi</span>
            </div>

            {/* Thanh nhập ngôn ngữ tự nhiên */}
            <form onSubmit={handleNaturalPrompt} className="mb-4 relative">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder='VD: "2 Phin sữa đá buổi chiều"...'
                className="w-full text-xs pl-3 pr-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-pink-500"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-pink-600 hover:text-pink-700 p-1"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            {/* Danh sách món */}
            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
              {MENU_ITEMS.map((item) => {
                const qty = cart[item.id] || 0;
                const isSuggested =
                  upsellRecommendation?.addedItem.id === item.id;
                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border transition flex items-center justify-between ${
                      isSuggested
                        ? "border-amber-400 bg-amber-50/70 ring-1 ring-amber-300"
                        : qty > 0
                          ? "border-pink-300 bg-pink-50/40"
                          : "border-slate-100 hover:border-slate-200"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-800">
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-slate-700">
                          {item.price.toLocaleString("vi-VN")}đ
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                          {item.category}
                        </span>
                        {isSuggested && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-white font-semibold animate-pulse">
                            + Thêm để giảm sâu!
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        disabled={qty === 0}
                        className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-5 text-center text-sm font-bold">
                        {qty}
                      </span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        className="w-7 h-7 rounded-lg bg-pink-600 text-white flex items-center justify-center hover:bg-pink-700"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Tạm tính giỏ hàng:</span>
            <span className="text-base font-bold text-slate-900">
              {subtotal.toLocaleString("vi-VN")}đ
            </span>
          </div>
        </section>

        {/* CỘT 2: KHO ƯU ĐÃI & SOI BẪY ĐIỀU KHOẢN ẨN (4 CỘT) */}
        <section className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-base flex items-center gap-2">
              <Ticket className="w-5 h-5 text-pink-600" />
              Kho Voucher & Bẫy Điều Khoản ({vouchers.length})
            </h2>
          </div>

          <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
            {evaluatedList.map(
              ({ voucher, isEligible, reasons, discountAmount }) => {
                const isBest = bestCurrent?.voucher.id === voucher.id;
                return (
                  <div
                    key={voucher.id}
                    className={`p-3.5 rounded-xl border transition ${
                      isBest
                        ? "border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-400"
                        : isEligible
                          ? "border-slate-200 bg-white"
                          : "border-slate-100 bg-slate-50 opacity-75"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-white">
                            {voucher.code}
                          </span>
                          {voucher.acquisitionType === "COIN_REDEEM" && (
                            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-1">
                              <Coins className="w-3 h-3" /> Đổi{" "}
                              {voucher.coinCost} Xu
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-sm text-slate-900 mt-1">
                          {voucher.title}
                        </h3>
                      </div>

                      {isBest && (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-600 text-white shrink-0">
                          TỐT NHẤT
                        </span>
                      )}
                    </div>

                    {/* Các nhãn cảnh báo điều khoản ẩn do AI bóc tách */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {voucher.hiddenTraps.map((trap, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-medium px-2 py-0.5 rounded bg-orange-100 text-orange-800 flex items-center gap-1"
                        >
                          <ShieldAlert className="w-3 h-3" /> {trap}
                        </span>
                      ))}
                    </div>

                    {/* Kết quả kiểm tra điều kiện */}
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-xs">
                      {isEligible ? (
                        <div className="flex items-center justify-between text-emerald-700 font-semibold">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Hợp lệ
                          </span>
                          <span>
                            Giảm -{discountAmount.toLocaleString("vi-VN")}đ
                          </span>
                        </div>
                      ) : (
                        <div className="text-rose-600 flex items-start gap-1">
                          <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{reasons[0]}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </section>

        {/* CỘT 3: AI COPILOT REASONING & CHỐT ĐƠN TỐI ƯU (4 CỘT) */}
        <section className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="font-bold text-base flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-amber-500" />
              Phân Tích Từ AI Copilot
            </h2>

            {/* Hộp Reasoning Trace trực tiếp */}
            <div className="bg-slate-900 text-slate-300 rounded-xl p-3.5 text-xs font-mono space-y-1.5 mb-4">
              <div className="text-emerald-400 font-semibold">
                &gt; Agent đang quét {vouchers.length} ưu đãi & {userCoins}{" "}
                Xu...
              </div>
              <div>
                • Đã loại {evaluatedList.filter((e) => !e.isEligible).length} mã
                dính điều khoản ẩn (sai giờ, loại trừ món hoặc thiếu ngưỡng).
              </div>
              <div>
                • Tìm thấy {evaluatedList.filter((e) => e.isEligible).length} mã
                hợp lệ cho giỏ hàng {subtotal.toLocaleString("vi-VN")}đ.
              </div>
              {upsellRecommendation && (
                <div className="text-amber-300">
                  ! Phát hiện tổ hợp Upsell giúp tổng tiền trả cuối cùng RẺ HƠN
                  hiện tại!
                </div>
              )}
            </div>

            {/* Thẻ gợi ý Smart Upsell (nếu có) */}
            {upsellRecommendation && (
              <div className="mb-4 p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300">
                <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  MẸO GHÉP ĐƠN THÔNG MINH (RẺ HƠN MUA ÍT)
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Thêm <strong>1 {upsellRecommendation.addedItem.name}</strong>{" "}
                  (+
                  {upsellRecommendation.addedItem.price.toLocaleString("vi-VN")}
                  đ) để đủ điều kiện dùng mã{" "}
                  <strong>
                    {upsellRecommendation.bestVoucher.voucher.code}
                  </strong>{" "}
                  (-
                  {upsellRecommendation.bestVoucher.discountAmount.toLocaleString(
                    "vi-VN",
                  )}
                  đ). Bạn chỉ phải trả{" "}
                  <strong className="text-pink-600">
                    {upsellRecommendation.newFinalPrice.toLocaleString("vi-VN")}
                    đ
                  </strong>{" "}
                  (tiết kiệm thêm{" "}
                  <strong>
                    {upsellRecommendation.netGain.toLocaleString("vi-VN")}đ
                  </strong>{" "}
                  mà lại có thêm bánh!).
                </p>
                <button
                  onClick={() =>
                    updateQty(upsellRecommendation.addedItem.id, 1)
                  }
                  className="mt-2.5 w-full py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1 transition"
                >
                  Thêm {upsellRecommendation.addedItem.name} ngay{" "}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Bảng tổng kết thanh toán tối ưu */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Tổng tiền món:</span>
                <span className="font-semibold">
                  {subtotal.toLocaleString("vi-VN")}đ
                </span>
              </div>

              <div className="flex justify-between text-xs text-emerald-700">
                <span>
                  Mã tối ưu (
                  {bestCurrent ? bestCurrent.voucher.code : "Không có"}):
                </span>
                <span className="font-bold">
                  -
                  {bestCurrent
                    ? bestCurrent.discountAmount.toLocaleString("vi-VN")
                    : 0}
                  đ
                </span>
              </div>

              {bestCurrent && bestCurrent.voucher.coinCost > 0 && (
                <div className="flex justify-between text-xs text-amber-700">
                  <span>Chi phí đổi Xu tự động:</span>
                  <span className="font-semibold">
                    -{bestCurrent.voucher.coinCost} Xu
                  </span>
                </div>
              )}

              <div className="pt-2.5 border-t border-slate-200 flex items-baseline justify-between">
                <span className="text-sm font-bold text-slate-800">
                  Số tiền thanh toán:
                </span>
                <span className="text-2xl font-extrabold text-pink-600">
                  {currentFinalPrice.toLocaleString("vi-VN")}đ
                </span>
              </div>
            </div>
          </div>

          {/* Nút xác nhận Human-in-the-loop */}
          <div className="mt-5">
            {checkoutSuccess ? (
              <div className="p-3 rounded-xl bg-emerald-600 text-white text-center text-xs font-bold">
                ✓ Đã đổi Xu, áp mã {bestCurrent?.voucher.code} và thanh toán
                thành công!
              </div>
            ) : (
              <button
                disabled={subtotal === 0}
                onClick={() => {
                  if (bestCurrent && bestCurrent.voucher.coinCost > 0) {
                    setUserCoins((c) =>
                      Math.max(0, c - bestCurrent.voucher.coinCost),
                    );
                  }
                  setCheckoutSuccess(true);
                }}
                className="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-700 disabled:bg-slate-300 text-white font-bold text-sm shadow-md shadow-pink-200 transition"
              >
                Xác Nhận Áp Mã & Thanh Toán
              </button>
            )}
            <p className="text-[11px] text-slate-400 text-center mt-2 flex items-center justify-center gap-1">
              <Info className="w-3 h-3" /> AI chỉ thực thi giao dịch sau khi bạn
              bấm xác nhận
            </p>
          </div>
        </section>
      </main>

      {/* ==========================================
          MODAL NẠP VOUCHER THẬT (DEMO POLICY-PARSER)
         ========================================== */}
      {showIngestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="font-bold text-base text-slate-900 mb-1">
              Nạp Điều Khoản Voucher Mới (AI Policy Parser)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Dán đoạn text điều khoản từ app MoMo/Highlands thật để AI tự bóc
              tách luật ẩn và đưa vào bài toán tối ưu.
            </p>
            <textarea
              rows={4}
              value={rawNewTerms}
              onChange={(e) => setRawNewTerms(e.target.value)}
              placeholder="Ví dụ: Giảm 35K cho hóa đơn từ 85K. Không áp dụng Freeze và các sản phẩm đóng gói..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-pink-500 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowIngestModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                onClick={handleParseNewVoucher}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-pink-600 text-white hover:bg-pink-700"
              >
                Bóc Tách & Thêm Vào Ví
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
