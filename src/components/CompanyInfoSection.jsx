import React from 'react';
import { Shield, FileCheck, Building, Calendar, Scale } from 'lucide-react';
import { motion } from 'framer-motion';

function CompanyInfoSection() {
  return (
    <section className="py-16 bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-navy mb-4">
            Official Registration
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Alpha Bridge is fully registered and compliant with the laws of the Republic of Rwanda.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Certificate Image */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gold/10 rounded-xl transform translate-x-4 translate-y-4"></div>
            <img 
              src="https://horizons-cdn.hostinger.com/81ef3422-3855-479e-bfe8-28a4ceb0df39/ea644c584a1b4177047d03ed1000c0ad.png" 
              alt="Alpha Bridge Certificate of Incorporation" 
              className="relative rounded-xl shadow-2xl border border-gray-200 w-full"
            />
          </motion.div>

          {/* Details Card */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-100"
          >
            <div className="bg-navy p-6">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-gold" />
                <div>
                  <h3 className="text-xl font-bold text-white">Company Details</h3>
                  <p className="text-blue-200 text-sm">RDB Office of the Registrar General</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 text-navy font-semibold mb-1">
                    <Building className="w-4 h-4 text-tech-blue" />
                    Company Name
                  </div>
                  <p className="text-gray-700 pl-6">Alpha Bridge</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-navy font-semibold mb-1">
                    <FileCheck className="w-4 h-4 text-tech-blue" />
                    Company Code
                  </div>
                  <p className="text-gray-700 pl-6 font-mono bg-gray-50 inline-block px-2 rounded">151541639</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-navy font-semibold mb-1">
                    <Calendar className="w-4 h-4 text-tech-blue" />
                    Registration Date
                  </div>
                  <p className="text-gray-700 pl-6">22/11/2025</p>
                </div>

                 <div>
                  <div className="flex items-center gap-2 text-navy font-semibold mb-1">
                    <Calendar className="w-4 h-4 text-tech-blue" />
                    Issuance Date
                  </div>
                  <p className="text-gray-700 pl-6">22/11/2025</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-navy font-semibold mb-1">
                    <Scale className="w-4 h-4 text-tech-blue" />
                    Category & Type
                  </div>
                  <p className="text-gray-700 pl-6">Private, Limited by shares</p>
                </div>

                <div>
                   <div className="flex items-center gap-2 text-navy font-semibold mb-1">
                    <FileCheck className="w-4 h-4 text-tech-blue" />
                    Barcode Reference
                  </div>
                   <p className="text-gray-700 pl-6 font-mono text-sm">151541639</p>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <p className="text-sm text-gray-500 italic">
                  <span className="font-semibold text-navy not-italic">Governing Law: </span>
                  Article 23 of Law N° 007/2021 of 05/02/2021 governing companies.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default CompanyInfoSection;