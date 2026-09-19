import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Platform roles (global scope)
// ---------------------------------------------------------------------------
export const PLATFORM_ROLES = {
  SUPER_ADMIN: "super_admin",
} as const;

// ---------------------------------------------------------------------------
// Tenant roles
// ---------------------------------------------------------------------------
export const TENANT_ROLES = {
  OWNER: "owner",
  STAFF: "staff",
} as const;

export const ORDER_STATUSES = [
  "pending",
  "payment_pending",
  "paid",
  "processing",
  "ready",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;

const themeValidator = v.object({
  brand: v.object({
    name: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
  }),
  colors: v.object({
    primary: v.optional(v.string()),
    primaryForeground: v.optional(v.string()),
    background: v.optional(v.string()),
    foreground: v.optional(v.string()),
    card: v.optional(v.string()),
    muted: v.optional(v.string()),
    mutedForeground: v.optional(v.string()),
    accent: v.optional(v.string()),
    border: v.optional(v.string()),
    radius: v.optional(v.string()),
  }),
  typography: v.object({
    heading: v.optional(v.string()),
    body: v.optional(v.string()),
  }),
  header: v.object({
    announcement: v.optional(v.string()),
    links: v.optional(v.array(v.object({ label: v.string(), href: v.string() }))),
    showWhatsapp: v.optional(v.boolean()),
  }),
  footer: v.object({
    text: v.optional(v.string()),
    links: v.optional(v.array(v.object({ label: v.string(), href: v.string() }))),
  }),
});

const blockValidator = v.object({
  id: v.string(),
  type: v.string(),
  position: v.number(),
  hidden: v.optional(v.boolean()),
  settings: v.any(),
});

const seoValidator = v.object({
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  ogImage: v.optional(v.string()),
  noindex: v.optional(v.boolean()),
});

const schema = defineSchema(
  {
    // Default auth tables (Convex Auth). Do not remove or modify.
    ...authTables,

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(v.string()),
      platformRole: v.optional(v.literal(PLATFORM_ROLES.SUPER_ADMIN)),
    }).index("email", ["email"]),

    // -----------------------------------------------------------------------
    // Platform
    // -----------------------------------------------------------------------
    plans: defineTable({
      code: v.string(), // FREE | BASIC | PRO | BUSINESS | ENTERPRISE
      name: v.string(),
      priceMonthly: v.number(),
      currency: v.string(),
      limits: v.object({
        maxProducts: v.number(),
        maxStaff: v.number(),
        maxStorageMb: v.number(),
        customDomain: v.boolean(),
        analytics: v.boolean(),
        coupons: v.boolean(),
        whatsapp: v.boolean(),
        paymentIntegrations: v.boolean(),
        apiAccess: v.boolean(),
      }),
      isActive: v.boolean(),
    }).index("by_code", ["code"]),

    subscriptions: defineTable({
      tenantId: v.id("tenants"),
      planCode: v.string(),
      status: v.union(v.literal("active"), v.literal("trialing"), v.literal("past_due"), v.literal("cancelled")),
      startedAt: v.number(),
      renewsAt: v.optional(v.number()),
    }).index("by_tenant", ["tenantId"]),

    featureFlags: defineTable({
      key: v.string(),
      enabled: v.boolean(),
      description: v.optional(v.string()),
    }).index("by_key", ["key"]),

    platformSettings: defineTable({
      key: v.string(),
      value: v.any(),
    }).index("by_key", ["key"]),

    // -----------------------------------------------------------------------
    // Tenancy
    // -----------------------------------------------------------------------
    tenants: defineTable({
      name: v.string(),
      slug: v.string(),
      status: v.union(v.literal("active"), v.literal("suspended"), v.literal("draft")),
      template: v.optional(v.string()),
      planCode: v.string(),
      logoUrl: v.optional(v.string()),
      currency: v.optional(v.string()),
      whatsappPhone: v.optional(v.string()),
      whatsappEnabled: v.optional(v.boolean()),
      couponsEnabled: v.optional(v.boolean()),
      deliveryEnabled: v.optional(v.boolean()),
      paymentProvider: v.optional(v.string()), // manual | culqi
      seo: v.optional(seoValidator),
      suspendedReason: v.optional(v.string()),
      isDemo: v.optional(v.boolean()),
      createdAt: v.number(),
    })
      .index("by_slug", ["slug"])
      .index("by_status", ["status"]),

    tenantMembers: defineTable({
      tenantId: v.id("tenants"),
      userId: v.optional(v.id("users")),
      userEmail: v.string(),
      userName: v.optional(v.string()),
      role: v.union(v.literal("owner"), v.literal("staff")),
      permissions: v.optional(v.array(v.string())), // staff overrides
      invitedAt: v.number(),
      joinedAt: v.optional(v.number()),
    })
      .index("by_tenant", ["tenantId"])
      .index("by_tenant_email", ["tenantId", "userEmail"])
      .index("by_user", ["userId"]),

    tenantSettings: defineTable({
      tenantId: v.id("tenants"),
      key: v.string(),
      value: v.any(),
    })
      .index("by_tenant_key", ["tenantId", "key"])
      .index("by_tenant", ["tenantId"]),

    tenantDomains: defineTable({
      tenantId: v.id("tenants"),
      domain: v.string(),
      type: v.union(v.literal("subdomain"), v.literal("custom")),
      status: v.union(v.literal("pending"), v.literal("active"), v.literal("failed")),
      verifiedAt: v.optional(v.number()),
      sslStatus: v.optional(v.string()),
    })
      .index("by_tenant", ["tenantId"])
      .index("by_domain", ["domain"]),

    tenantThemes: defineTable({
      tenantId: v.id("tenants"),
      status: v.union(v.literal("draft"), v.literal("published")),
      version: v.number(),
      theme: themeValidator,
      updatedAt: v.number(),
      publishedAt: v.optional(v.number()),
    })
      .index("by_tenant_status", ["tenantId", "status"])
      .index("by_tenant", ["tenantId"]),

    // Page builder (blocks per page, draft/published)
    pages: defineTable({
      tenantId: v.id("tenants"),
      slug: v.string(),
      title: v.string(),
      isHome: v.boolean(),
      status: v.union(v.literal("draft"), v.literal("published")),
      version: v.number(),
      blocks: v.array(blockValidator),
      updatedAt: v.number(),
    })
      .index("by_tenant_status", ["tenantId", "status"])
      .index("by_tenant_slug", ["tenantId", "slug"]),

    // -----------------------------------------------------------------------
    // Catalog
    // -----------------------------------------------------------------------
    brands: defineTable({
      tenantId: v.id("tenants"),
      name: v.string(),
      slug: v.string(),
    }).index("by_tenant", ["tenantId"]),

    categories: defineTable({
      tenantId: v.id("tenants"),
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      parentId: v.optional(v.id("categories")),
      position: v.optional(v.number()),
    })
      .index("by_tenant", ["tenantId"])
      .index("by_tenant_parent", ["tenantId", "parentId"])
      .index("by_tenant_slug", ["tenantId", "slug"]),

    products: defineTable({
      tenantId: v.id("tenants"),
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      shortDescription: v.optional(v.string()),
      sku: v.optional(v.string()),
      price: v.number(),
      comparePrice: v.optional(v.number()),
      cost: v.optional(v.number()),
      stock: v.number(),
      status: v.union(v.literal("active"), v.literal("draft"), v.literal("archived")),
      featured: v.boolean(),
      brandId: v.optional(v.id("brands")),
      categoryId: v.optional(v.id("categories")),
      images: v.optional(v.array(v.string())),
      hasVariants: v.optional(v.boolean()),
      options: v.optional(v.array(v.object({ name: v.string(), values: v.array(v.string()) }))),
      weight: v.optional(v.number()),
      dimensions: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_tenant", ["tenantId"])
      .index("by_tenant_status", ["tenantId", "status"])
      .index("by_tenant_slug", ["tenantId", "slug"])
      .index("by_tenant_featured", ["tenantId", "featured"])
      .index("by_tenant_category", ["tenantId", "categoryId"]),

    productVariants: defineTable({
      tenantId: v.id("tenants"),
      productId: v.id("products"),
      sku: v.optional(v.string()),
      options: v.array(v.object({ name: v.string(), value: v.string() })),
      price: v.optional(v.number()),
      stock: v.number(),
      imageUrl: v.optional(v.string()),
      weight: v.optional(v.number()),
      dimensions: v.optional(v.string()),
    }).index("by_product", ["productId"]),

    inventoryMovements: defineTable({
      tenantId: v.id("tenants"),
      productId: v.id("products"),
      variantId: v.optional(v.id("productVariants")),
      delta: v.number(),
      reason: v.string(),
      orderId: v.optional(v.id("orders")),
      createdAt: v.number(),
    }).index("by_product", ["productId"]),

    media: defineTable({
      tenantId: v.id("tenants"),
      storageId: v.string(),
      url: v.string(),
      name: v.string(),
      folder: v.string(), // branding | products | banners | pages | users
      size: v.optional(v.number()),
      contentType: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_tenant_folder", ["tenantId", "folder"]),

    // -----------------------------------------------------------------------
    // Customers
    // -----------------------------------------------------------------------
    customers: defineTable({
      tenantId: v.id("tenants"),
      name: v.string(),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      totalOrders: v.number(),
      totalSpent: v.number(),
      createdAt: v.number(),
    })
      .index("by_tenant_email", ["tenantId", "email"])
      .index("by_tenant_phone", ["tenantId", "phone"])
      .index("by_tenant", ["tenantId"]),

    customerAddresses: defineTable({
      tenantId: v.id("tenants"),
      customerId: v.id("customers"),
      label: v.optional(v.string()),
      line1: v.string(),
      city: v.optional(v.string()),
      region: v.optional(v.string()),
      postalCode: v.optional(v.string()),
      reference: v.optional(v.string()),
      isDefault: v.optional(v.boolean()),
    }).index("by_customer", ["customerId"]),

    // -----------------------------------------------------------------------
    // Cart
    // -----------------------------------------------------------------------
    carts: defineTable({
      tenantId: v.id("tenants"),
      sessionKey: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_tenant_session", ["tenantId", "sessionKey"]),

    cartItems: defineTable({
      cartId: v.id("carts"),
      tenantId: v.id("tenants"),
      productId: v.id("products"),
      variantId: v.optional(v.id("productVariants")),
      name: v.string(),
      variantLabel: v.optional(v.string()),
      unitPrice: v.number(),
      quantity: v.number(),
      imageUrl: v.optional(v.string()),
    }).index("by_cart", ["cartId"]),

    // -----------------------------------------------------------------------
    // Orders
    // -----------------------------------------------------------------------
    orders: defineTable({
      tenantId: v.id("tenants"),
      number: v.string(),
      customerId: v.optional(v.id("customers")),
      customerName: v.string(),
      customerEmail: v.optional(v.string()),
      customerPhone: v.string(),
      status: v.string(), // ORDER_STATUSES
      itemsTotal: v.number(),
      discountTotal: v.number(),
      deliveryTotal: v.number(),
      total: v.number(),
      currency: v.string(),
      couponCode: v.optional(v.string()),
      deliveryMethod: v.optional(v.string()),
      deliveryRateId: v.optional(v.id("deliveryRates")),
      address: v.optional(
        v.object({ line1: v.string(), city: v.optional(v.string()), region: v.optional(v.string()), reference: v.optional(v.string()) }),
      ),
      notes: v.optional(v.string()),
      idempotencyKey: v.optional(v.string()),
      isDemo: v.optional(v.boolean()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_tenant", ["tenantId"])
      .index("by_tenant_number", ["tenantId", "number"])
      .index("by_number", ["number"])
      .index("by_idempotency_key", ["idempotencyKey"]),

    orderItems: defineTable({
      tenantId: v.id("tenants"),
      orderId: v.id("orders"),
      productId: v.id("products"),
      variantId: v.optional(v.id("productVariants")),
      name: v.string(),
      variantLabel: v.optional(v.string()),
      unitPrice: v.number(),
      quantity: v.number(),
      total: v.number(),
      imageUrl: v.optional(v.string()),
    }).index("by_order", ["orderId"]),

    orderStatusHistory: defineTable({
      tenantId: v.id("tenants"),
      orderId: v.id("orders"),
      fromStatus: v.optional(v.string()),
      toStatus: v.string(),
      note: v.optional(v.string()),
      actor: v.string(), // system | staff user name | webhook
      createdAt: v.number(),
    }).index("by_order", ["orderId"]),

    // -----------------------------------------------------------------------
    // Payments
    // -----------------------------------------------------------------------
    payments: defineTable({
      tenantId: v.id("tenants"),
      orderId: v.id("orders"),
      provider: v.string(),
      providerPaymentId: v.optional(v.string()),
      amount: v.number(),
      currency: v.string(),
      status: v.union(v.literal("pending"), v.literal("succeeded"), v.literal("failed"), v.literal("refunded")),
      raw: v.optional(v.any()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_order", ["orderId"]),

    paymentLinks: defineTable({
      tenantId: v.id("tenants"),
      orderId: v.id("orders"),
      orderNumber: v.string(),
      provider: v.string(),
      providerLinkId: v.optional(v.string()),
      token: v.string(),
      url: v.string(),
      amount: v.number(),
      currency: v.string(),
      status: v.union(v.literal("pending"), v.literal("paid"), v.literal("expired"), v.literal("cancelled")),
      expiresAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_token", ["token"])
      .index("by_tenant_order", ["tenantId", "orderId"])
      .index("by_order", ["orderId"]),

    paymentEvents: defineTable({
      tenantId: v.optional(v.id("tenants")),
      provider: v.string(),
      eventId: v.string(),
      eventType: v.string(),
      verified: v.boolean(),
      simulated: v.optional(v.boolean()),
      payload: v.optional(v.any()),
      processedAt: v.number(),
    }).index("by_provider_event", ["provider", "eventId"]),

    // -----------------------------------------------------------------------
    // Coupons
    // -----------------------------------------------------------------------
    coupons: defineTable({
      tenantId: v.id("tenants"),
      code: v.string(),
      type: v.union(v.literal("percentage"), v.literal("fixed_amount"), v.literal("free_shipping")),
      value: v.number(),
      minAmount: v.optional(v.number()),
      maxUses: v.optional(v.number()),
      maxUsesPerCustomer: v.optional(v.number()),
      firstPurchaseOnly: v.optional(v.boolean()),
      startsAt: v.optional(v.number()),
      endsAt: v.optional(v.number()),
      isActive: v.boolean(),
      usageCount: v.number(),
    }).index("by_tenant_code", ["tenantId", "code"]),

    couponUsages: defineTable({
      tenantId: v.id("tenants"),
      couponId: v.id("coupons"),
      orderId: v.id("orders"),
      customerEmail: v.optional(v.string()),
      amount: v.number(),
      createdAt: v.number(),
    }).index("by_coupon", ["couponId"]),

    // -----------------------------------------------------------------------
    // Delivery
    // -----------------------------------------------------------------------
    deliveryZones: defineTable({
      tenantId: v.id("tenants"),
      name: v.string(),
      description: v.optional(v.string()),
      isActive: v.boolean(),
    }).index("by_tenant", ["tenantId"]),

    deliveryRates: defineTable({
      tenantId: v.id("tenants"),
      zoneId: v.id("deliveryZones"),
      name: v.string(),
      method: v.union(v.literal("pickup"), v.literal("delivery"), v.literal("shipping")),
      price: v.number(),
      freeOver: v.optional(v.number()),
      minOrder: v.optional(v.number()),
      eta: v.optional(v.string()),
      isActive: v.boolean(),
    })
      .index("by_zone", ["zoneId"])
      .index("by_tenant", ["tenantId"]),

    // -----------------------------------------------------------------------
    // Analytics, audit, notifications
    // -----------------------------------------------------------------------
    analyticsEvents: defineTable({
      tenantId: v.id("tenants"),
      type: v.union(
        v.literal("page_view"),
        v.literal("product_view"),
        v.literal("add_to_cart"),
        v.literal("checkout_started"),
        v.literal("order_created"),
        v.literal("payment_succeeded"),
        v.literal("whatsapp_click"),
      ),
      sessionId: v.optional(v.string()),
      productId: v.optional(v.id("products")),
      path: v.optional(v.string()),
      value: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_tenant_type_time", ["tenantId", "type", "createdAt"]),

    auditLogs: defineTable({
      actorId: v.optional(v.id("users")),
      actorLabel: v.string(),
      tenantId: v.optional(v.id("tenants")),
      action: v.string(),
      resource: v.string(),
      resourceId: v.optional(v.string()),
      oldData: v.optional(v.any()),
      newData: v.optional(v.any()),
      ip: v.optional(v.string()),
      userAgent: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_tenant_time", ["tenantId", "createdAt"])
      .index("by_time", ["createdAt"]),

    notificationTemplates: defineTable({
      tenantId: v.id("tenants"),
      key: v.string(),
      channel: v.string(),
      subject: v.optional(v.string()),
      body: v.string(),
    }).index("by_tenant_key", ["tenantId", "key"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
