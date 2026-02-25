import PaySuccessClient from "./ui/PaySuccessClient";

export default async function PaySuccessPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <PaySuccessClient draftId={id} />;
}