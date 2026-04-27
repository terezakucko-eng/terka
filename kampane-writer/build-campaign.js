// Convert simplified campaign description into the exact Firestore document
// shape the Netlify app expects (fields keyed by HTML input id).
//
// Input: a plain object — see example.json for the full structure.
// Output: { name, startDate, endDate, data, visibility, channelSpecs, createdAt }

const COUNTRIES = ["CZ", "SK", "HU", "RO", "SI", "HR", "BG"];
const SMS_COUNTRIES = ["cz", "sk", "hu"];

const DEFAULT_VISIBILITY = {
  main: true,
  keymessage: true,
  flashsale: true,
  graphics: true,
  graphicchannels: true,
  adminslider: true,
  adminrozcestnik: true,
  admincoupon: true,
  seo: true,
  sms: true,
  social: true,
  media: true,
};

// Channels in section "graphicchannels" — id is the lowercased + dashed
// label after "N. ". Order/text must match the HTML.
const GRAPHIC_CHANNELS = [
  { num: 1, label: "1. BANNER HP", id: "banner-hp" },
  { num: 2, label: "2. BANNER kategorie", id: "banner-kategorie" },
  { num: 3, label: "3. BANNER detail produktu", id: "banner-detail-produktu" },
  { num: 4, label: "4. BANNER rozcestník", id: "banner-rozcestník" },
  { num: 5, label: "5. BANNER newsletter", id: "banner-newsletter" },
  { num: 6, label: "6. BANNER affiliate", id: "banner-affiliate" },
  { num: 7, label: "7. PPC SKLIK", id: "ppc-sklik" },
  { num: 8, label: "8. FIRMY.cz - reklama", id: "firmy.cz---reklama" },
  { num: 9, label: "9. FIRMY.cz - branding", id: "firmy.cz---branding" },
  { num: 10, label: "10. GOOGLE FIRMY", id: "google-firmy" },
  { num: 11, label: "11. HEUREKA display", id: "heureka-display" },
  { num: 12, label: "12. IG - feed", id: "ig---feed" },
  { num: 13, label: "13. IG - story", id: "ig---story" },
  { num: 14, label: "14. RETINO", id: "retino" },
  { num: 15, label: "15. Grafika pro prodejny", id: "grafika-pro-prodejny" },
];

// "Marketing channel" checkboxes in section keymessage.
const KEYMESSAGE_CHANNELS = [
  "heureka",
  "social",
  "ppc",
  "webbanners",
  "gscWindow",
  "gscCountdown",
  "sms",
  "coupon",
  "freeshipping",
  "newsletter",
  "affiliate",
  "stores",
  "radio",
  "tv",
  "billboards",
  "otherEnabled",
];

function setPerCountry(data, prefix, perCountry) {
  if (!perCountry) return;
  for (const c of COUNTRIES) {
    data[`${prefix}-${c}`] = perCountry[c] ?? "";
  }
}

function setBoolPerCountry(data, prefix, perCountry) {
  if (!perCountry) return;
  for (const c of COUNTRIES) {
    data[`${prefix}-${c}`] = !!perCountry[c];
  }
}

export function buildCampaign(input) {
  const data = {};

  // 1. Main
  data.campaignName = input.name || "";
  data.campaignStartDate = input.startDate || "";
  data.campaignEndDate = input.endDate || "";
  data.mainReferer = input.main?.referer || "";
  data.mainGiftCode = input.main?.giftCode || "";
  data.mainLpCategory = input.main?.lpCategory || "";
  data.mainAdminCategoryId = input.main?.adminCategoryId || "";
  data.mainLpSubcategory = input.main?.lpSubcategory || "";
  data.mainNotes = input.main?.notes || "";
  setPerCountry(data, "mainCouponText", input.main?.couponText);
  setPerCountry(data, "mainDiscountAmount", input.main?.discountAmount);

  // 2. Key message
  data.keymessageEmotionalLine = input.keymessage?.emotionalLine || "";
  data.keymessageToneOfVoice = input.keymessage?.toneOfVoice || "";
  data.keymessageCampaignGoals = input.keymessage?.goals || "";
  for (const ch of KEYMESSAGE_CHANNELS) {
    data[`keymessage-channel-${ch}`] = !!input.keymessage?.channels?.[ch];
  }
  data["keymessage-channel-other"] = input.keymessage?.channels?.otherText || "";

  // 3. Flash sale (1..18 products)
  for (let i = 1; i <= 18; i++) {
    const p = input.flashsale?.[`product${i}`] || {};
    data[`flashsale-product${i}-url`] = p.url || "";
    for (const c of COUNTRIES) {
      data[`flashsale-product${i}-regularprice-${c}`] = p.regularPrice?.[c] ?? "";
      data[`flashsale-product${i}-minprice-${c}`] = p.minPrice?.[c] ?? "";
      data[`flashsale-product${i}-saleprice-${c}`] = p.salePrice?.[c] ?? "";
    }
  }

  // 4. Graphics
  data.graphicsDiskUrl = input.graphics?.diskUrl || "";
  setPerCountry(data, "graphicsMainMessage", input.graphics?.mainMessage);
  setPerCountry(data, "graphicsCTA", input.graphics?.cta);
  setPerCountry(data, "graphicsCTAButton", input.graphics?.ctaButton);
  data.graphicsNote = input.graphics?.note || "";
  setPerCountry(data, "graphicsCouponText", input.graphics?.couponText);
  setPerCountry(data, "graphicsGiftValue", input.graphics?.giftValue);
  setPerCountry(data, "graphicsGiftMinOrder", input.graphics?.giftMinOrder);
  data.graphicsProductListUrl = input.graphics?.productListUrl || "";

  // 5. Graphic channels (per-country checkboxes)
  for (const ch of GRAPHIC_CHANNELS) {
    const perCountry = input.graphicchannels?.[ch.id] || {};
    for (const c of COUNTRIES) {
      data[`graphicchannel-${ch.id}-${c}`] = !!perCountry[c];
    }
  }

  // 6. Admin slider
  setPerCountry(data, "sliderButtonText", input.adminslider?.buttonText);
  setPerCountry(data, "sliderAltText", input.adminslider?.altText);
  data.sliderLinkUrl = input.adminslider?.linkUrl || "{categoryUrl:00000}{/categoryUrl}";

  // 7. Admin rozcestník
  setPerCountry(data, "rozcestnikTitle", input.adminrozcestnik?.title);
  data.rozcestnikLinkUrl =
    input.adminrozcestnik?.linkUrl || "{categoryUrl:00000}{/categoryUrl}";

  // 8. Admin coupon
  setPerCountry(data, "couponCode", input.admincoupon?.code);
  setBoolPerCountry(data, "couponShowAtProduct", input.admincoupon?.showAtProduct);
  setBoolPerCountry(data, "couponCombinable", input.admincoupon?.combinable);
  setBoolPerCountry(data, "couponFirstPurchase", input.admincoupon?.firstPurchase);
  data.couponShippingPaymentFree = input.admincoupon?.shippingPaymentFree || "";
  data.couponType = input.admincoupon?.type || "Částka";
  setPerCountry(data, "couponNote", input.admincoupon?.note);
  data.couponDiscountValue = input.admincoupon?.discountValue || "";
  data.couponOrderNote = input.admincoupon?.orderNote || "";
  data.couponMaxUsage =
    input.admincoupon?.maxUsage != null ? String(input.admincoupon.maxUsage) : "";
  data.couponMinOrderValue = input.admincoupon?.minOrderValue || "";
  data.couponValidFrom = input.admincoupon?.validFrom || "";
  data.couponValidTo = input.admincoupon?.validTo || "";
  data.couponReferer = input.admincoupon?.referer || "";
  data.couponSource = input.admincoupon?.source || "";
  data.couponConditionType = input.admincoupon?.conditionType || "KATEGORIE";
  data.couponConditionDetail = input.admincoupon?.conditionDetail || "";
  data.couponBILinks =
    input.admincoupon?.biLinks ||
    "https://docs.google.com/spreadsheets/d/1W7hOkI7S6KhNbX7eNtVcajwN4U47bH6M_eaqLpKsFRU/edit?gid=569211844#gid=569211844";

  // 9. SEO
  setPerCountry(data, "seoMetaDescription", input.seo?.metaDescription);
  setPerCountry(data, "seoCategoryDescription", input.seo?.categoryDescription);
  data.seoArticleNote = input.seo?.articleNote || "";
  data.seoArticleId = input.seo?.articleId || "";
  data.seoArticleLink = input.seo?.articleLink || "";

  // 10. SMS (sms1, sms2; per-country: cz/sk/hu)
  for (const slot of ["sms1", "sms2"]) {
    const s = input.sms?.[slot] || {};
    data[`${slot}-text-url`] = s.textUrl || "";
    for (const c of SMS_COUNTRIES) {
      const sc = s[c.toUpperCase()] || {};
      data[`${slot}-${c}-date`] = sc.date || "";
      data[`${slot}-${c}-segment`] = sc.segment || "";
      data[`${slot}-${c}-url`] = sc.url || "";
      data[`${slot}-${c}-list`] = sc.list || "";
      data[`${slot}-${c}-setup`] = sc.setup || "";
    }
  }
  data["sms-bi-log-url"] =
    input.sms?.biLogUrl ||
    "https://docs.google.com/spreadsheets/d/1UBs5y3Dgh9ZtR73rz_QQFuHpD-LeF9JjGDOKijetfsU/edit?gid=902486596#gid=902486596";

  // 11. Social
  data["socialStories-CZ"] = input.social?.stories?.CZ || "";
  data["socialStories-SK"] = input.social?.stories?.SK || "";
  data["socialStories-Other"] = input.social?.stories?.Other || "";
  data["socialPaidPost-CZ"] = input.social?.paidPost?.CZ || "";
  data["socialPaidPost-SK"] = input.social?.paidPost?.SK || "";
  data["socialPaidPost-Other"] = input.social?.paidPost?.Other || "";
  data["socialOrganicPost-CZ"] = input.social?.organicPost?.CZ || "";
  data["socialOrganicPost-SK"] = input.social?.organicPost?.SK || "";
  data["socialOrganicPost-Other"] = input.social?.organicPost?.Other || "";
  data["socialInfluencer-CZ"] = input.social?.influencer?.CZ || "";
  data["socialInfluencer-SK"] = input.social?.influencer?.SK || "";
  data["socialInfluencer-Other"] = input.social?.influencer?.Other || "";
  data.socialOtherRequirements = input.social?.otherRequirements || "";

  // 12. Media
  data.mediaRadio = input.media?.radio || "";
  data.mediaTV = input.media?.tv || "";
  data.mediaBillboards = input.media?.billboards || "";

  const visibility = { ...DEFAULT_VISIBILITY, ...(input.visibility || {}) };

  // channelSpecs: keyed by exact channel label (matches HTML data-channel)
  const channelSpecs = {};
  if (input.channelSpecs) {
    for (const ch of GRAPHIC_CHANNELS) {
      if (input.channelSpecs[ch.id]) channelSpecs[ch.label] = input.channelSpecs[ch.id];
    }
  }

  return {
    name: input.name || "",
    startDate: input.startDate || null,
    endDate: input.endDate || null,
    data,
    visibility,
    channelSpecs,
    createdAt: new Date(),
  };
}
