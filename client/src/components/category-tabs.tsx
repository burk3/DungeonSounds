import { SoundCategory } from "@shared/schema";

interface CategoryTabsProps {
  categories: readonly SoundCategory[];
  activeCategory: SoundCategory;
  setActiveCategory: (category: SoundCategory) => void;
  variant?: "desktop" | "mobile";
}

export default function CategoryTabs({ 
  categories, 
  activeCategory, 
  setActiveCategory,
  variant = "desktop"
}: CategoryTabsProps) {
  // Determine if we should use desktop or mobile tab styling
  const isMobile = variant === "mobile";
  
  return (
    <>
      {isMobile ? (
        // Mobile tabs with horizontal scroll
        <>
          {categories.map((category) => (
            <button 
              key={category}
              className={`py-3 px-4 font-medium whitespace-nowrap border-b-2 ${
                activeCategory === category 
                  ? "text-primary border-primary" 
                  : "text-gray-500 hover:text-primary border-transparent"
              }`}
              onClick={() => setActiveCategory(category)}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </>
      ) : (
        // Desktop tabs
        <div className="border-b border-gray-200 mb-6 relative">
          <div className="flex space-x-8">
            {categories.map((category) => (
              <button 
                key={category}
                className={`py-2 px-1 font-medium text-lg relative transition-colors duration-200 ${
                  activeCategory === category 
                    ? "text-primary" 
                    : "text-gray-500 hover:text-primary"
                }`}
                onClick={() => setActiveCategory(category)}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
                {/* Active indicator */}
                {activeCategory === category && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
