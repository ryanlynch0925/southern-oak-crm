import { BRAND_LOGO_SRC } from "../../theme";

interface LogoProps {
  light?: boolean;
  sm?: boolean;
}

export default function Logo({ light = true, sm = false }: LogoProps) {
  void light;
  return <img src={BRAND_LOGO_SRC} alt="Southern Oak Concrete & Construction" style={{ display: "block", height: sm ? 34 : 56, width: "auto" }} />;
}
