import { supabase } from "../../../lib/supabase";
import { appBuilderToDatabaseBuilder, databaseBuilderToAppBuilder, sortBuildersByName } from "../builders/builderUtils";

export async function fetchBuilders() {
  const { data, error } = await supabase
    .from("builders")
    .select("id,name,primary_contact,phone,communities,color,active,created_at,updated_at")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return sortBuildersByName((data || []).map(databaseBuilderToAppBuilder));
}

export async function createBuilder(builder) {
  const { data, error } = await supabase
    .from("builders")
    .insert(appBuilderToDatabaseBuilder(builder))
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return databaseBuilderToAppBuilder(data);
}
