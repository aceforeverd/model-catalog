import { fetchCatalog } from "../lib/catalog";
import { VariantsPage } from "../pages/variants";
import { mount } from "./app";

mount(async () => <VariantsPage catalog={await fetchCatalog("./")} />);
