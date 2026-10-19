import { createFileRoute } from "@tanstack/react-router";
import { LocationsPage } from "@/features/catalog/LocationsPage";
import { entitySearchSchema } from "@/lib/search";

export const Route = createFileRoute("/_app/locations")({
  validateSearch: (search) => entitySearchSchema.parse(search),
  component: LocationsPage,
  head: () => ({ meta: [{ title: "Localizações · Gestão de Inventário" }] }),
});
