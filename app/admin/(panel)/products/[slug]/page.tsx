import { ProductEditor } from "@/components/admin/product-editor";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ProductEditor slug={slug} />;
}
