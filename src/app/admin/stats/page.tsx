import { prisma } from "@/lib/prisma";
import AdminStatsClient from "./AdminStatsClient";

export const metadata = {
  title: "Статистика | SATL-админ",
};

export default async function AdminStatsPage() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    completedOrders,
    canceledOrders,
    usersTotal,
    verifiedUsers,
    newsletterUsers,
    users7,
    users30,
    users,
    ordersTotal,
    ordersNew,
    ordersProcessing,
    ordersShipped,
    ordersCompleted,
    ordersCanceled,
    ordersReturned,
    productsTotal,
    productsOutOfStock,
    productsWithDiscount,
    categoriesTotal,
  ] = await Promise.all([
    prisma.order.findMany({
      where: { status: "COMPLETED" },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.findMany({
      where: { status: "CANCELED" },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { isVerified: true } }),
    prisma.user.count({ where: { newsletterEnabled: true } }),
    prisma.user.count({
      where: {
        createdAt: { gte: d7 },
      },
    }),
    prisma.user.count({
      where: {
        createdAt: { gte: d30 },
      },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        phone: true,
        isVerified: true,
        newsletterEnabled: true,
        createdAt: true,
        orders: {
          select: {
            id: true,
            total: true,
            status: true,
          },
        },
      },
    }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "NEW" } }),
    prisma.order.count({ where: { status: "PROCESSING" } }),
    prisma.order.count({ where: { status: "SHIPPED" } }),
    prisma.order.count({ where: { status: "COMPLETED" } }),
    prisma.order.count({ where: { status: "CANCELED" } }),
    prisma.order.count({ where: { status: "RETURNED" } }),
    prisma.product.count(),
    prisma.product.count({
      where: {
        variants: {
          every: {
            stock: 0,
          },
        },
      },
    }),
    prisma.product.count({
      where: {
        OR: [{ discountPercent: { gt: 0 } }, { discountPrice: { not: null } }],
      },
    }),
    prisma.category.count(),
  ]);

  const revenueAll = completedOrders.reduce((sum, order) => sum + order.total, 0);

  const revenueToday = completedOrders
    .filter((o) => o.createdAt >= todayStart)
    .reduce((sum, o) => sum + o.total, 0);

  const revenue7 = completedOrders
    .filter((o) => o.createdAt >= d7)
    .reduce((sum, o) => sum + o.total, 0);

  const revenue30 = completedOrders
    .filter((o) => o.createdAt >= d30)
    .reduce((sum, o) => sum + o.total, 0);

  const avgCheck =
    completedOrders.length > 0 ? Math.round(revenueAll / completedOrders.length) : 0;

  const canceledRevenue = canceledOrders.reduce((sum, order) => sum + order.total, 0);
  const canceledCount = canceledOrders.length;

  const completedItems = completedOrders.flatMap((o) => o.items);
  const topMap = new Map<string, { quantity: number; total: number }>();

  for (const item of completedItems) {
    const current = topMap.get(item.title) ?? {
      quantity: 0,
      total: 0,
    };

    current.quantity += item.quantity;
    current.total += item.price * item.quantity;

    topMap.set(item.title, current);
  }

  const top = Array.from(topMap.entries())
    .map(([title, data]) => ({
      title,
      quantity: data.quantity,
      total: data.total,
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const canceledItems = canceledOrders.flatMap((o) => o.items);
  const canceledMap = new Map<string, { quantity: number; total: number }>();

  for (const item of canceledItems) {
    const current = canceledMap.get(item.title) ?? {
      quantity: 0,
      total: 0,
    };

    current.quantity += item.quantity;
    current.total += item.price * item.quantity;

    canceledMap.set(item.title, current);
  }

  const topCanceled = Array.from(canceledMap.entries())
    .map(([title, data]) => ({
      title,
      quantity: data.quantity,
      total: data.total,
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const usersTable = users.map((u) => {
    const fullName = [u.name, u.lastName].filter(Boolean).join(" ").trim();
    const completedOnly = u.orders.filter((o) => o.status === "COMPLETED");
    const ordersTotalSum = completedOnly.reduce((sum, o) => sum + (o.total ?? 0), 0);

    return {
      id: u.id,
      name: fullName || "—",
      email: u.email,
      phone: u.phone || "—",
      isVerified: u.isVerified,
      newsletterEnabled: u.newsletterEnabled,
      createdAt: u.createdAt.toISOString(),
      ordersCount: u.orders.length,
      deliveredCount: completedOnly.length,
      ordersTotalSum,
    };
  });

  return (
    <AdminStatsClient
      summary={{
        usersTotal,
        verifiedUsers,
        newsletterUsers,
        users7,
        users30,
        ordersTotal,
        ordersNew,
        ordersProcessing,
        ordersShipped,
        ordersDelivered: ordersCompleted,
        ordersCanceled,
        ordersReturned,
        productsTotal,
        productsOutOfStock,
        productsWithDiscount,
        categoriesTotal,
        revenueAll,
        revenueToday,
        revenue7,
        revenue30,
        avgCheck,
        canceledRevenue,
        canceledCount,
      }}
      users={usersTable}
      top={top}
      topCanceled={topCanceled}
    />
  );
}