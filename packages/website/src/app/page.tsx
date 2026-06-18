import type { Metadata } from "next";
import Terminal from "@/components/terminal";

export const metadata: Metadata = {
  title: "React Doctor — ReactLynx extension",
  description: "An extension of react.doctor that adds ReactLynx-specific checks. The canonical project is at react.doctor.",
};

const Home = () => <Terminal />;

export default Home;
