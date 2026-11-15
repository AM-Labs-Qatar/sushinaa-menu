import { notFound } from "next/navigation";
import { BRANCHES, findBranch, configuredBranches } from "@/branches/branches";
import { getMenu } from "@/cms/repository";
import { MenuProvider } from "@/cms/context";
import { publicMenu } from "@/cms/schema";
import { MenuFeed } from "@/components/menu/MenuFeed";
import { OrderingExperience } from "@/components/checkout/OrderingExperience";
import { orderingEnabled } from "@/ordering/config";
import { currentStorefront } from "@/storefront/server";
import { pageMeta } from "@/lib/page-meta";
import "../order/order.css";

type Props = { params: Promise<{ branch: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return BRANCHES.map((b) => ({ branch: b.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { menu } = await getMenu();
  const selected = (await params).branch;
  const current = configuredBranches(menu.branches).find(
    (b) => b.slug === selected,
  );
  if (!current) return {};
  return pageMeta(
    (t) => `${t.menu} · ${current.name}`,
    (t) => t.menuBlurb,
    `/${current.slug}`,
  );
}

// Same catalog for every branch. Host selects browse vs pickup storefront.
export default async function BranchMenu({ params }: Props) {
  const branch = findBranch((await params).branch);
  if (!branch) notFound();
  const storefront = await currentStorefront();
  const { menu } = await getMenu();
  const published = publicMenu(menu, storefront.channel);
  const canOrder =
    storefront.mode === "pickup" && orderingEnabled(branch.slug);
  if (canOrder) {
    return (
      <MenuProvider menu={published}>
        <OrderingExperience
          initialNow={new Date().toISOString()}
          branchId={branch.slug}
        />
      </MenuProvider>
    );
  }
  return (
    <div className="app-lock">
      <MenuProvider menu={published}>
        <MenuFeed
          branch={
            configuredBranches(menu.branches).find((b) => b.slug === branch.slug)!
              .name
          }
        />
      </MenuProvider>
    </div>
  );
}
