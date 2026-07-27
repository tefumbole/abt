import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, GripVertical, Trash2, Mail, Phone, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFlagByCountry } from '@/utils/countryFlags';

// MemberCard: Primarily used in the Admin dashboard.
// Accepts isAdminView to toggle private contact details.
const MemberCard = ({
  member,
  onEdit,
  onDelete,
  isAdminView = false,
  orderIndex = null,
  className,
}) => {
  return (
    <Card
      className={cn(
        'overflow-hidden hover:shadow-lg transition-all duration-300 border-t-4 border-t-[#003D82] group h-full relative',
        className
      )}
    >
      {isAdminView && orderIndex != null && (
        <span
          className="absolute top-2 left-2 z-10 inline-flex items-center gap-0.5 rounded-full bg-[#003D82] text-white text-[10px] font-bold px-2 py-0.5 shadow"
          title="Drag card to reorder"
        >
          <GripVertical className="w-3 h-3 opacity-90" />
          #{orderIndex + 1}
        </span>
      )}
      <CardContent className="p-6 text-center flex flex-col h-full">
        <div className="relative w-24 h-24 mx-auto rounded-full overflow-hidden border-2 border-[#D4AF37] mb-4 shadow-md bg-gray-50 group-hover:scale-105 transition-transform duration-300 pointer-events-none">
          {member.photo_url ? (
            <img
              src={member.photo_url}
              alt={member.name}
              className="w-full h-full object-cover"
              draggable={false}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src =
                  'https://ui-avatars.com/api/?name=' +
                  encodeURIComponent(member.name) +
                  '&background=random';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
              <span className="text-2xl font-bold text-[#003D82] opacity-50">
                {member.name ? member.name.charAt(0).toUpperCase() : <User className="w-10 h-10" />}
              </span>
            </div>
          )}
        </div>

        <h3
          className="text-xl font-bold text-[#003D82] mb-1 line-clamp-1 flex items-center justify-center gap-2"
          title={member.country ? `${member.name} · ${member.country}` : member.name}
        >
          <span className="truncate">{member.name}</span>
          {getFlagByCountry(member.country) && (
            <span className="text-base shrink-0">{getFlagByCountry(member.country)}</span>
          )}
        </h3>
        <p
          className="text-sm font-semibold text-[#D4AF37] uppercase tracking-wide mb-3 line-clamp-1"
          title={member.title}
        >
          {member.title}
        </p>

        <p className="text-sm text-gray-600 line-clamp-3 mb-4 min-h-[60px] flex-grow">
          {member.description || 'No description provided.'}
        </p>

        {isAdminView ? (
          <div
            className={cn(
              'flex flex-col gap-2 mb-4 text-xs text-gray-500',
              !member.email && !member.phone && 'invisible'
            )}
          >
            {member.email ? (
              <div className="flex items-center justify-center gap-2 bg-blue-50/50 py-1.5 rounded text-blue-800">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[200px]">{member.email}</span>
              </div>
            ) : (
              <div className="h-[26px]" />
            )}

            {member.phone ? (
              <div className="flex items-center justify-center gap-2 bg-gray-50 py-1.5 rounded text-gray-700">
                <Phone className="w-3 h-3 shrink-0" />
                <span>{member.phone}</span>
              </div>
            ) : (
              <div className="h-[26px]" />
            )}
          </div>
        ) : null}

        <div
          className="flex justify-center gap-2 pt-4 border-t border-gray-100 mt-auto"
          onMouseDown={(e) => e.stopPropagation()}
          onDragStart={(e) => e.preventDefault()}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(member)}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 w-full"
          >
            <Edit className="w-4 h-4 mr-2" /> Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(member)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full"
          >
            <Trash2 className="w-4 h-4 mr-2" /> Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MemberCard;
