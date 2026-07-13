import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase";
import App from "./src/App";

void supabase;
type PreservedSessionImport = Session;

export default App;
