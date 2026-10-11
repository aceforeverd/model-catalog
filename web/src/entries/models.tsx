import { fetchCatalog } from "../lib/catalog";
import { ModelsPage } from "../pages/models";
import { mount } from "./app";

mount(async () => <ModelsPage catalog={await fetchCatalog("./")} />);
