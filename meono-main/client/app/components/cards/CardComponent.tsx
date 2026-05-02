import {forwardRef, HTMLAttributes, useState} from "react";
import {Card, CardNames, CardTooltips} from "../../../../server/shared/card";

interface CardComponentProps {
  card: Card;
  showTooltips: boolean;
  showInfoButton?: boolean; // New prop to control info button visibility
}

/**
 * Purely visual rendering of a given card
 */

const CardComponent = forwardRef<HTMLDivElement, CardComponentProps & HTMLAttributes<HTMLDivElement>>(({card, showTooltips, showInfoButton = false, ...props}, ref) => {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <>
      <div ref={ref} {...props} className={"md:w-36 w-24 rounded-md text-center select-none " + props.className} title={showTooltips ? CardTooltips.get(card) : ""}>
        <img alt={CardNames.get(card)} src={"/cards/" + card + ".png"}/>
        
        {/* Info button - only show if showInfoButton is true and card is not BACK */}
        {showInfoButton && card !== Card.BACK && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowInfo(!showInfo);
            }}
            className="absolute top-1 right-1 w-6 h-6 bg-blue-500 text-white rounded-full text-xs font-bold hover:bg-blue-600 flex items-center justify-center shadow-lg z-10"
          >
            !
          </button>
        )}
      </div>

      {/* Info popup - rendered outside card to avoid positioning issues */}
      {showInfo && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-[100]"
            onClick={(e) => {
              e.stopPropagation();
              setShowInfo(false);
            }}
          />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white text-black p-4 rounded-lg shadow-xl z-[101] w-80 max-w-md">
            <div className="font-bold text-lg mb-2">{CardNames.get(card)}</div>
            <div className="text-sm whitespace-pre-wrap">{CardTooltips.get(card)}</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowInfo(false);
              }}
              className="mt-3 w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
            >
              Đóng
            </button>
          </div>
        </>
      )}
    </>
  )
});

export default CardComponent;